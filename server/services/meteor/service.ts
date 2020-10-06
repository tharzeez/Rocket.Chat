import { Meteor } from 'meteor/meteor';
import { ServiceConfiguration } from 'meteor/service-configuration';

import { ServiceClass } from '../../sdk/types/ServiceClass';
import { IMeteor, AutoUpdateRecord } from '../../sdk/types/IMeteor';
import { api } from '../../sdk/api';
import { Users } from '../../../app/models/server/raw/index';
import { Livechat } from '../../../app/livechat/server';
import { settings } from '../../../app/settings/server/functions/settings';
import { setValue, updateValue } from '../../../app/settings/server/raw';


const autoUpdateRecords = new Map<string, AutoUpdateRecord>();

Meteor.server.publish_handlers.meteor_autoupdate_clientVersions.call({
	added(_collection: string, id: string, version: AutoUpdateRecord) {
		autoUpdateRecords.set(id, version);
	},
	changed(_collection: string, id: string, version: AutoUpdateRecord) {
		autoUpdateRecords.set(id, version);
		api.broadcast('meteor.autoUpdateClientVersionChanged', { record: version });
	},
	onStop() {
		//
	},
	ready() {
		//
	},
});

export class MeteorService extends ServiceClass implements IMeteor {
	protected name = 'meteor';

	constructor() {
		super();

		this.onEvent('watch.settings', async ({ clientAction, setting }): Promise<void> => {
			if (clientAction !== 'removed') {
				settings.storeSettingValue(setting, false);
				updateValue(setting._id, { value: setting.value });
				return;
			}

			settings.removeSettingValue(setting, false);
			setValue(setting._id, undefined);
		});
	}

	async getLastAutoUpdateClientVersions(): Promise<AutoUpdateRecord[]> {
		return [...autoUpdateRecords.values()];
	}

	async getLoginServiceConfiguration(): Promise<any[]> {
		return ServiceConfiguration.configurations.find({}, { fields: { secret: 0 } }).fetch();
	}

	async callMethodWithToken(userId: string, token: string, method: string, args: any[]): Promise<void | any> {
		const user = await Users.findOneByIdAndLoginHashedToken(userId, token, { projection: { _id: 1 } });
		if (!user) {
			return {
				result: Meteor.call(method, ...args),
			};
		}

		return {
			result: Meteor.runAsUser(userId, () => Meteor.call(method, ...args)),
		};
	}

	async notifyGuestStatusChanged(token: string, status: string): Promise<void> {
		return Livechat.notifyGuestStatusChanged(token, status);
	}
}
