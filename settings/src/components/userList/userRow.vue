<template>
	<div class="row">
		<div class="avatar"><img alt="" width="32" height="32" :src="generateAvatar(user.id, 32)" :srcset="generateAvatar(user.id, 64)+' 2x, '+generateAvatar(user.id, 128)+' 4x'"></div>
		<div class="name">{{user.id}}</div>
		<form class="displayName" :class="{'icon-loading-small': loading.displayName}" form v-on:submit.prevent="updateDisplayName">
			<input :id="'displayName'+user.id+rand" type="text"
					:disabled="loading.displayName||loading.all"
					:value="user.displayname" ref="displayName"
					autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" />
			<input type="submit" class="icon-confirm" value="" />
		</form>
		<form class="password" :class="{'icon-loading-small': loading.password}" v-on:submit.prevent="updatePassword">
			<input :id="'password'+user.id+rand" type="password"
					:disabled="loading.password||loading.all" :minlength="minPasswordLength"
					value="" placeholder="●●●●●●●●●●" ref="password"
					autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" />
			<input type="submit" class="icon-confirm" value="" />
		</form>
		<form class="mailAddress" :class="{'icon-loading-small': loading.mailAddress}" v-on:submit.prevent="updateEmail">
			<input :id="'mailAddress'+user.id+rand" type="email"
					:disabled="loading.mailAddress||loading.all"
					:value="user.email" ref="mailAddress"
					autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" />
			<input type="submit" class="icon-confirm" value="" />
		</form>
		<div class="groups" :class="{'icon-loading-small': loading.groups}">
			<multiselect :value="userGroups" :options="groups" :disabled="loading.groups||loading.all"
						 tag-placeholder="create" :placeholder="t('settings', 'Add user in group')"
						 label="name" track-by="id" class="multiselect-vue"
						 :multiple="true" :taggable="true" :close-on-select="false"
						 @tag="createGroup" @input="setUserGroups">
			</multiselect>
		</div>
		<div class="subadmins" v-if="subAdminsGroups.length>0" :class="{'icon-loading-small': loading.subadmins}">
			<multiselect :value="userSubAdminsGroups" :options="subAdminsGroups" :disabled="loading.subadmins||loading.all"
						 :placeholder="t('settings', 'Set user as admin for')"
						 label="name" track-by="id" class="multiselect-vue"
						 :multiple="true" :close-on-select="false"
						 @input="setUserSubAdminsGroups">
				<span slot="noResult">{{t('settings','No result')}}</span>
			</multiselect>
		</div>
		<div v-if="settings.recoveryAdminEnabled" ></div>
		<div class="quota" :class="{'icon-loading-small': loading.quota}">
			<multiselect :value="userQuota" :options="quotaOptions" :disabled="loading.quota||loading.all"
						 tag-placeholder="create" :placeholder="t('settings', 'Select user quota')"
						 label="label" track-by="id" class="multiselect-vue"
						 :allowEmpty="false" :taggable="true"
						 @tag="validateQuota" @input="setUserQuota">
			</multiselect>
			<progress class="quota-user-progress" :class="{'warn':usedQuota>80}" :value="usedQuota" max="100"></progress>
		</div>
		<div class="storageLocation" v-if="showConfig.storageLocation">{{user.storageLocation}}</div>
		<div class="userBackend" v-if="showConfig.userBackend">{{user.backend}}</div>
		<div class="lastLogin" v-if="showConfig.lastLogin">{{user.lastLogin>0 ? OC.Util.relativeModifiedDate(user.lastLogin) : t('settings','Never')}}</div>
		<div class="userActions">
			<div class="toggleUserActions" v-if="OC.currentUser !== user.id && user.id !== 'admin' && !loading">
				<div class="icon-more" v-click-outside="hideMenu" @click="showMenu"></div>
				<div class="popovermenu" :class="{ 'open': openedMenu }">
					<popover-menu :menu="userActions" />
				</div>
			</div>
		</div>
		</div>
</template>

<script>
import popoverMenu from '../popoverMenu';
import ClickOutside from 'vue-click-outside';
import Multiselect from 'vue-multiselect';

export default {
	name: 'userRow',
	props: ['user', 'settings', 'groups', 'subAdminsGroups', 'quotaOptions', 'showConfig'],
	components: {
		popoverMenu,
		Multiselect
	},
	directives: {
		ClickOutside
	},
	mounted() {
		// prevent click outside event with popupItem.
		this.popupItem = this.$el;
	},
	data() {
		return {
			rand: parseInt(Math.random() * 1000),
			openedMenu: false,
			loading: {
				all: false,
				displayName: false,
				password: false,
				mailAddress: false,
				groups: false,
				subadmins: false,
				quota: false
			}
		}
	},
	computed: {
		/* USER POPOVERMENU ACTIONS */
		userActions() {
			return [{
				icon: 'icon-delete',
				text: t('settings','Delete user'),
				action: 'deleteUser',
				data: this.user.id
			},{
				'icon': this.user.isEnabled ? 'icon-close' : 'icon-add',
				'text': this.user.isEnabled ? t('settings','Disable user') : t('settings','Enable user'),
				'action': 'enableDisableUser',
				data: {userid: this.user.id, enabled: !this.user.isEnabled}
			}]
		},

		/* GROUPS MANAGEMENT */
		userGroups() {
			let userGroups = this.groups.filter(group => this.user.groups.includes(group.id));
			return userGroups;
		},
		userSubAdminsGroups() {
			let userSubAdminsGroups = this.subAdminsGroups.filter(group => this.user.subadmin.includes(group.id));
			return userSubAdminsGroups;
		},

		/* QUOTA MANAGEMENT */
		usedQuota() {
			let quota = this.user.quota.quota;
			if (quota > 0) {
				quota = Math.min(100, Math.round(this.user.quota.used / quota * 100));
			} else {
				var usedInGB = this.user.quota.used / (10 * Math.pow(2, 30));
				//asymptotic curve approaching 50% at 10GB to visualize used stace with infinite quota
				quota = 95 * (1 - (1 / (usedInGB + 1)));
			}
			return isNaN(quota) ? 0 : quota;
		},
		// Mapping saved values to objects
		userQuota() {
			if (this.user.quota.quota > 0) {
				// if value is valid, let's map the quotaOptions or return custom quota
				let humanQuota = OC.Util.humanFileSize(this.user.quota.quota);
				let userQuota = this.quotaOptions.find(quota => quota.id === humanQuota);
				return userQuota ? userQuota : {id:humanQuota, label:humanQuota};
			} else if (this.user.quota.quota === 0 || this.user.quota.quota === 'default') {
				// default quota is replaced by the proper value on load
				return this.quotaOptions[0];
			}
			return this.quotaOptions[1]; // unlimited
		},

		/* PASSWORD POLICY? */
		minPasswordLength() {
			return this.$store.getters.getPasswordPolicyMinLength;
		}
	},
	methods: {
		/* MENU HANDLING */
		showMenu () {
			this.openedMenu = true;
		},
		hideMenu () {
			this.openedMenu = false;
		},

		/**
		 * Generate avatar url
		 * 
		 * @param {string} user The user name
		 * @param {int} size Size integer, default 32
		 * @returns {string}
		 */
		generateAvatar(user, size=32) {
			return OC.generateUrl(
				'/avatar/{user}/{size}?v={version}',
				{
					user: user,
					size: size,
					version: oc_userconfig.avatar.version
				}
			);
		},

		/**
		 * Set user displayName
		 * 
		 * @param {string} displayName The display name
		 * @returns {Promise}
		 */
		updateDisplayName() {
			let displayName = this.$refs.displayName.value;
			this.loading.displayName = true;
			this.$store.dispatch('setUserData', {
				userid: this.user.id, 
				key:'displayname',
				value: displayName
			}).then(() => {
				this.loading.displayName = false;
				this.$refs.displayName.value = displayName;
			});
		},

		/**
		 * Set user mailAddress
		 * 
		 * @param {string} mailAddress The email adress
		 * @returns {Promise}
		 */
		updateEmail() {
			let mailAddress = this.$refs.mailAddress.value;
			this.loading.mailAddress = true;
			this.$store.dispatch('setUserData', {
				userid: this.user.id,
				key:'email',
				value: mailAddress
			}).then(() => {
				this.loading.mailAddress = false;
				this.$refs.mailAddress.value = mailAddress;
			});
		},

		/**
		 * Create a new group
		 * 
		 * @param {string} groups Group id
		 * @returns {Promise}
		 */
		createGroup(gid) {
			this.loading = {groups:true, subadmins:true}
			this.$store.dispatch('addGroup', gid).then(() => {
				this.loading = {groups:false, subadmins:false};
				let userid = this.user.id;
				this.$store.dispatch('addUserGroup', {userid, gid});
			});
			return this.$store.getters.getGroups[this.groups.length];
		},

		/**
		 * Set user groups
		 * 
		 * @param {string[]} groups Array of groups ids as string
		 * @returns {Promise|boolean}
		 */
		setUserGroups(groups) {
			if (Array.isArray(groups) && groups.length > 0) {
				this.loading.groups = true;
				groups = groups.map(group => group.id); // convert objects into array
				let userid = this.user.id;
				return this.$store.dispatch('setUserGroups', {userid, groups})
					.then(() => this.loading.groups = false);
			}
			return false;
		},

		/**
		 * Set user as admin of groups
		 * 
		 * @param {string[]} groups Array of groups ids as string
		 * @returns {Promise|boolean}
		 */
		setUserSubAdminsGroups(groups) {
			if (Array.isArray(groups) && groups.length > 0) {
				this.loading.subadmins = true;
				groups = groups.map(group => group.id); // convert objects into array
				let userid = this.user.id;
				return this.$store.dispatch('setUserSubAdmins', {userid, groups})
					.then(() => this.loading.subadmins = false);
			}
			return false;
		},

		/**
		 * Validate quota string to make sure it's a valid human file size
		 * 
		 * @param {string|Object} quota Quota in readable format '5 GB' or Object {id: '5 GB', label: '5GB'}
		 * @returns {string}
		 */
		setUserQuota(quota = 'none') {
			this.loading.quota = true;
			// ensure we only send the preset id
			quota = quota.id ? quota.id : quota;
			this.$store.dispatch('setUserData', {
				userid: this.user.id, 
				key: 'quota',
				value: quota
			}).then(() => this.loading.quota = false);
			return quota;
		},

		/**
		 * Validate quota string to make sure it's a valid human file size
		 * 
		 * @param {string} quota Quota in readable format '5 GB'
		 * @returns {Promise|boolean}
		 */
		validateQuota(quota) {
			// only used for new presets sent through @Tag
			let validQuota = OC.Util.computerFileSize(quota);
			if (validQuota === 0) {
				return this.setUserQuota('none');
			} else if (validQuota !== null) {
				// unify format output
				return this.setUserQuota(OC.Util.humanFileSize(OC.Util.computerFileSize(quota)));
			}
			// if no valid doo not change
			return false;
		}
	}
}
</script>
