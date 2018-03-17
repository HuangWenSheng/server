<template>
	<div id="app-content" class="user-list-grid">
		<div class="row" id="grid-header">
			<div id="headerAvatar"></div>
			<div id="headerName">{{ t('settings', 'Username') }}</div>
			<div id="headerDisplayName">{{ t('settings',  'Full name') }}</div>
			<div id="headerPassword">{{ t('settings',  'Password') }}</div>
			<div id="headerAddress">{{ t('settings',  'Email') }}</div>
			<div id="headerGroups">{{ t('settings',  'Groups') }}</div>
			<div id="headerSubAdmins" 
				 v-if="subAdminsGroups.length>0">{{ t('settings', 'Group admin for') }}</div>
			<div id="recoveryPassword" 
				 v-if="settings.recoveryAdminEnabled">{{ t('settings', 'Recovery password') }}</div>
			<div id="headerQuota">{{ t('settings', 'Quota') }}</div>
			<div class="headerStorageLocation storageLocation" 
				 v-if="showConfig.storageLocation">{{ t('settings', 'Storage location') }}</div>
			<div class="headerUserBackend userBackend" 
				 v-if="showConfig.userBackend">{{ t('settings', 'User backend') }}</div>
			<div class="headerLastLogin lastLogin" 
				 v-if="showConfig.lastLogin">{{ t('settings', 'Last login') }}</div>
			<div class="userActions"></div>
		</div>

		<form class="row" id="new-user" v-on:submit.prevent="createUser" :disabled="loading">
			<div :class="loading?'icon-loading-small':'icon-add'"></div>
			<div class="name">
				<input id="newusername" type="text" required v-model="newUser.id"
					   :placeholder="t('settings', 'User name')" name="username"
					   autocomplete="off" autocapitalize="none" autocorrect="off"
					   pattern="[a-zA-Z0-9 _\.@\-']+">
			</div>
			<div class="displayName">
				<input id="newdisplayname" type="text" v-model="newUser.displayName"
					   :placeholder="t('settings', 'Display name')" name="displayname"
					   autocomplete="off" autocapitalize="none" autocorrect="off">
			</div>
			<div class="password">
				<input id="newuserpassword" type="password" v-model="newUser.password"
					   :required="newUser.mailAddress===''"
					   :placeholder="t('settings', 'Password')" name="password"
					   autocomplete="new-password" autocapitalize="none" autocorrect="off"
					   :minlength="minPasswordLength">
			</div>
			<div class="mailAddress">
				<input id="newemail" type="email" v-model="newUser.mailAddress"
					   :required="newUser.password===''"
					   :placeholder="t('settings', 'Mail address')" name="email"
					   autocomplete="off" autocapitalize="none" autocorrect="off">
			</div>
			<div class="groups">
				<multiselect :options="groups" v-model="newUser.groups"
							 :placeholder="t('settings', 'Add user in group')"
							 label="name" track-by="id" class="multiselect-vue"
							 :multiple="true" :close-on-select="false">
					<span slot="noResult">{{t('settings','No result')}}</span>
				</multiselect>
			</div>
			<div class="subadmins" v-if="subAdminsGroups.length>0">
				<multiselect :options="subAdminsGroups" v-model="newUser.subAdminsGroups"
							 :placeholder="t('settings', 'Set user as admin for')"
							 label="name" track-by="id" class="multiselect-vue"
							 :multiple="true" :close-on-select="false">
					<span slot="noResult">{{t('settings','No result')}}</span>
			</multiselect>
			</div>
			<div v-if="settings.recoveryAdminEnabled" ></div>
			<div class="quota">
				<multiselect :options="quotaOptions" v-model="newUser.quota"
							 :placeholder="t('settings', 'Select user quota')"
							 label="label" track-by="id" class="multiselect-vue"
							 :allowEmpty="false" :taggable="true"
						 	 @tag="validateQuota" >
				</multiselect>
			</div>
			<div class="storageLocation" v-if="showConfig.storageLocation"></div>
			<div class="userBackend" v-if="showConfig.userBackend"></div>
			<div class="lastLogin" v-if="showConfig.lastLogin"></div>
			<div class="userActions">
				<input type="submit" id="newsubmit" class="button primary icon-checkmark-white has-tooltip"
					   value="" :title="t('settings', 'Add a new user')">
				<input type="reset" id="newreset" class="button icon-close has-tooltip" @click="resetForm"
					   value="" :title="t('settings', 'Cancel and reset the form')">
			</div>
		</form>

		<user-row v-for="(user, key) in users" :user="user" :key="key" :settings="settings" :showConfig="showConfig"
				  :groups="groups" :subAdminsGroups="subAdminsGroups" :quotaOptions="quotaOptions" />
		<infinite-loading @infinite="infiniteHandler">
			<span slot="spinner"><div class="users-icon-loading"></div></span>
			<span slot="no-more"><div class="users-list-end">— {{t('settings', 'no more results')}} —</div></span>
		</infinite-loading>
	</div>
</template>

<script>
import userRow from './userList/userRow';
import Multiselect from 'vue-multiselect';
import InfiniteLoading from 'vue-infinite-loading';

export default {
	name: 'userList',
	props: ['users', 'showConfig'],
	components: {
		userRow,
		Multiselect,
		InfiniteLoading
	},
	data() {
		let unlimitedQuota = {id:'none', label:t('settings', 'Unlimited')},
			defaultQuota = {id:'default', label:t('settings', 'Default quota')};
		return {
			unlimitedQuota: unlimitedQuota,
			defaultQuota: defaultQuota,
			loading: false,
			newUser: {
				id:'',
				displayName:'',
				password:'',
				mailAddress:'',
				groups: [],
				subAdminsGroups: [],
				quota: defaultQuota
			}
		};
	},
	computed: {
		settings() {
			return this.$store.getters.getServerData;
		},
		groups() {
			// data provided php side + remove the disabled group
			return this.$store.getters.getGroups.filter(group => group.id !== '_disabledUsers');
		},
		subAdminsGroups() {
			// data provided php side
			return this.$store.getters.getServerData.subadmingroups;
		},
		quotaOptions() {
			// convert the preset array into objects
			let quotaPreset = this.settings.quotaPreset.reduce((acc, cur) => acc.concat({id:cur, label:cur}), []);
			// add default presets
			quotaPreset.unshift(this.unlimitedQuota);
			quotaPreset.unshift(this.defaultQuota);
			return quotaPreset;
		},
		minPasswordLength() {
			return this.$store.getters.getPasswordPolicyMinLength;
		},
		usersOffset() {
			return this.$store.getters.getUsersOffset;
		},
		usersLimit() {
			return this.$store.getters.getUsersLimit;
		},
	},
	methods: {

		/**
		 * Validate quota string to make sure it's a valid human file size
		 * 
		 * @param {string} quota Quota in readable format '5 GB'
		 * @returns {Object}
		 */
		validateQuota(quota) {
			// only used for new presets sent through @Tag
			let validQuota = OC.Util.computerFileSize(quota);
			if (validQuota !== null && validQuota > 0) {
				// unify format output
				quota = OC.Util.humanFileSize(OC.Util.computerFileSize(quota));
				return this.newUser.quota = {id: quota, label: quota};
			}
			// Default is unlimited
			return this.newUser.quota = this.quotaOptions[0];
		},

		infiniteHandler($state) {
			this.$store.dispatch('getUsers', {offset:this.usersOffset, limit:this.usersLimit})
				.then((response) => {response?$state.loaded():$state.complete()});
		},

		resetForm () {
			// revert form to original state
			Object.assign(this.newUser, this.$options.data.call(this).newUser);
			this.loading = false;
        },
		createUser() {
			this.loading = true;
			this.$store.dispatch('addUser', {
				userid: this.newUser.id,
				password: this.newUser.password,
				email: this.newUser.mailAddress,
				groups: this.newUser.groups.map(group => group.id)
			}).then(() =>this.resetForm());
		}
	}
}
</script>
