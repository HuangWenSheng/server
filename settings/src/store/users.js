import api from './api';

const state = {
    users: [],
    groups: [],
    minPasswordLength: 0,
    usersOffset: 0,
    usersLimit: 25,
};

const mutations = {
    appendUsers(state, usersObj) {
        // convert obj to array
        let users = state.users.concat(Object.keys(usersObj).map(userid => usersObj[userid]));
        state.usersOffset += state.usersLimit;
        state.users = users;
    },
    setPasswordPolicyMinLength(state, length) {
        state.minPasswordLength = length!=='' ? length : 0;
    },
    initGroups(state, groups) {
        state.groups = groups;
    },
    addGroup(state, groupid) {
        try {
            state.groups.push({
                id: groupid,
                name: groupid,
                usercount: 0 // user will be added after the creation
            });
        } catch (e) {
            console.log('Can\'t create group', e);
        }
    },
    addUserGroup(state, { userid, gid }) {
        // this should not be needed as it would means the user contains a group
        // the server database doesn't have.
        let group = state.groups.find(groupSearch => groupSearch.id == gid);
        if (group) {
            group.usercount++; // increase count
        }
        let groups = state.users.find(user => user.id == userid).groups;
        groups.push(gid);
    },
    removeUserGroup(state, { userid, gid }) {
        // this should not be needed as it would means the user contains a group
        // the server database doesn't have.
        let group = state.groups.find(groupSearch => groupSearch.id == gid);
        if (group) {
            group.usercount--; // lower count
        }
        let groups = state.users.find(user => user.id == userid).groups;
        delete groups[gid];
    },
    addUserSubAdmin(state, { userid, gid }) {
        let groups = state.users.find(user => user.id == userid).subadmin;
        groups.push(gid);
    },
    removeUserSubAdmin(state, { userid, gid }) {
        let groups = state.users.find(user => user.id == userid).subadmin;
        delete groups[gid];
    },
    deleteUser(state, userid) {
        let userIndex = state.users.findIndex(user => user.id == userid);
        state.users.splice(userIndex, 1);
    },
    addUserData(state, response) {
        state.users.push(response.data.ocs.data);
    },
    enableDisableUser(state, { userid, enabled }) {
        state.users.find(user => user.id == userid).isEnabled = enabled;
        state.groups.find(group => group.id == '_disabledUsers').usercount += enabled ? -1 : 1;
    },
    setUserData(state, { userid, key, value }) {
        if (key === 'quota') {
            let humanValue = OC.Util.computerFileSize(value);
            state.users.find(user => user.id == userid)[key][key] = humanValue?humanValue:value;
        } else {
            state.users.find(user => user.id == userid)[key] = value;
        }
    },
};

const getters = {
    getUsers(state) {
        return state.users;
    },
    getGroups(state) {
        return state.groups;
    },
    getPasswordPolicyMinLength(state) {
        return state.minPasswordLength;
    },
    getUsersOffset(state) {
        return state.usersOffset;
    },
    getUsersLimit(state) {
        return state.usersLimit;
    }
};

const actions = {
    /**
     * Get all users with full details
     * 
     * @param {Object} context
     * @param {Object} options
     * @param {int} options.offset List offset to request
     * @param {int} options.limit List number to return from offset
     * @returns {Promise}
     */
    getUsers(context, { offset, limit, search }) {
        search = typeof search === 'string' ? search : '';
        return api.get(OC.linkToOCS(`cloud/users/details?offset=${offset}&limit=${limit}&search=${search}`, 2))
            .then((response) => {
                if (Object.keys(response.data.ocs.data.users).length > 0) {
                    context.commit('appendUsers', response.data.ocs.data.users);
                    return true;
                }
                return false;
            })
            .catch((error) => context.commit('API_FAILURE', error));
    },

    getPasswordPolicyMinLength(context) {
        return api.get(OC.linkToOCS('apps/provisioning_api/api/v1/config/apps/password_policy/minLength', 2))
            .then((response) => context.commit('setPasswordPolicyMinLength', response.data.ocs.data.data))
            .catch((error) => context.commit('API_FAILURE', error));
    },

    /**
     * Dispatch addition or removal of users to groups
     * based on which groups he belonged and now belongs to
     * 
     * @param {Object} store
     * @param {Object} store.dispatch
     * @param {Object} store.state
     * @param {Object} options
     * @param {string} options.userid User id
     * @param {Array} options.groupsgid Group id
     */
    setUserGroups({ dispatch, state }, { userid, groups }) {
        let oldGroups = state.users.find(user => user.id == userid).groups;
        console.log(oldGroups, groups);
        // intersect the removed groups for the user
        let delGroups = oldGroups.filter(x => !groups.includes(x));
        // intersect the new groups for the user
        let addGroups = groups.filter(x => !oldGroups.includes(x));
        console.log(oldGroups, groups, delGroups, addGroups);
        // change local data
        if (addGroups.length > 0) {
            addGroups.forEach((gid) => dispatch('addUserGroup', { userid, gid }));
        }
        if (delGroups.length > 0) {
            delGroups.forEach((gid) => dispatch('removeUserGroup', { userid, gid }));
        }
    },

    /**
     * Dispatch addition or removal of users to groups admin
     * based on which groups he managed and now manage
     * 
     * @param {Object} store
     * @param {Object} store.dispatch
     * @param {Object} store.state
     * @param {Object} options
     * @param {string} options.userid User id
     * @param {Array} options.groupsgid Group id
     */
    setUserSubAdmins({ dispatch, state }, { userid, groups }) {
        let oldGroups = state.users.find(user => user.id == userid).subadmin;
        console.log(Object.keys(oldGroups), groups);
        // intersect the removed groups for the user
        let delGroups = Object.keys(oldGroups).filter(x => !groups.includes(x));
        // intersect the new groups for the user
        let addGroups = groups.filter(x => !Object.keys(oldGroups).includes(x));
        console.log(oldGroups, groups, delGroups, addGroups);
        // change local data
        if (addGroups.length > 0) {
            addGroups.forEach((gid) => dispatch('addUserSubAdmin', { userid, gid }));
        }
        if (delGroups.length > 0) {
            delGroups.forEach((gid) => dispatch('removeUserSubAdmin', { userid, gid }));
        }
    },

    /**
     * Add group
     * 
     * @param {Object} context
     * @param {string} gid Group id
     * @returns {Promise}
     */
    addGroup(context, gid) {
        return api.requireAdmin().then((response) => {
            return api.post(OC.linkToOCS(`cloud/groups`, 2), {groupid: gid})
                .then((response) => context.commit('addGroup', gid))
                .catch((error) => context.commit('API_FAILURE', error));
        });
    },

    /**
     * Add group
     * 
     * @param {Object} context
     * @param {string} gid Group id
     * @returns {Promise}
     */
    removeGroup(context, gid) {
        return api.requireAdmin().then((response) => {
            return api.post(OC.linkToOCS(`cloud/groups`, 2), {groupid: gid})
                .then((response) => context.commit('removeGroup', gid))
                .catch((error) => context.commit('API_FAILURE', error));
        });
    },

    /**
     * Add user to group
     * 
     * @param {Object} context
     * @param {Object} options
     * @param {string} options.userid User id
     * @param {string} options.gid Group id
     * @returns {Promise}
     */
    addUserGroup(context, { userid, gid }) {
        return api.requireAdmin().then((response) => {
            return api.post(OC.linkToOCS(`cloud/users/${userid}/groups`, 2), {groupid: gid})
                .then((response) => context.commit('addUserGroup', { userid, gid }))
                .catch((error) => context.commit('API_FAILURE', error));
        });
    },

    /**
     * Remove user from group
     * 
     * @param {Object} context
     * @param {Object} options
     * @param {string} options.userid User id
     * @param {string} options.gid Group id
     * @returns {Promise}
     */
    removeUserGroup(context, { userid, gid }) {
        return api.requireAdmin().then((response) => {
            return api.delete(OC.linkToOCS(`cloud/users/${userid}/groups`, 2), { groupid: gid })
                .then((response) => context.commit('removeUserGroup', { userid, gid }))
                .catch((error) => context.commit('API_FAILURE', { userid, error }));
        });
    },

    /**
     * Add user to group admin
     * 
     * @param {Object} context
     * @param {Object} options
     * @param {string} options.userid User id
     * @param {string} options.gid Group id
     * @returns {Promise}
     */
    addUserSubAdmin(context, { userid, gid }) {
        return api.requireAdmin().then((response) => {
            return api.post(OC.linkToOCS(`cloud/users/${userid}/subadmins`, 2),  {groupid: gid})
                .then((response) => context.commit('addUserSubAdmin', { userid, gid }))
                .catch((error) => context.commit('API_FAILURE', error));
        });
    },

    /**
     * Remove user from group admin
     * 
     * @param {Object} context
     * @param {Object} options
     * @param {string} options.userid User id
     * @param {string} options.gid Group id
     * @returns {Promise}
     */
    removeUserSubAdmin(context, { userid, gid }) {
        return api.requireAdmin().then((response) => {
            return api.delete(OC.linkToOCS(`cloud/users/${userid}/subadmins`, 2), { groupid: gid })
                .then((response) => context.commit('removeUserSubAdmin', { userid, gid }))
                .catch((error) => context.commit('API_FAILURE', { userid, error }));
        });
    },

    /**
     * Delete a user
     * 
     * @param {Object} context
     * @param {string} userid User id 
     * @returns {Promise}
     */
    deleteUser(context, userid) {
        return api.requireAdmin().then((response) => {
            return api.delete(OC.linkToOCS(`cloud/users/${userid}`, 2))
                .then((response) => context.commit('deleteUser', userid))
                .catch((error) => context.commit('API_FAILURE', { userid, error }));
        });
    },

    /**
     * Add a user
     * 
     * @param {Object} context
     * @param {Object} options
     * @param {string} options.userid User id
     * @param {string} options.password User password 
     * @param {string} options.email User email
     * @returns {Promise}
     */
    addUser({context, dispatch}, {userid, password, email, groups}) {
        return api.requireAdmin().then((response) => {
            return api.post(OC.linkToOCS(`cloud/users`, 2), {userid, password, email, groups})
                .then((response) => dispatch('addUserData', userid))
                .catch((error) => context.commit('API_FAILURE', { userid, error }));
        });
    },

    /**
     * Get user data and commit addition
     * 
     * @param {Object} context
     * @param {string} userid User id 
     * @returns {Promise}
     */
    addUserData(context, userid) {
        return api.requireAdmin().then((response) => {
            return api.get(OC.linkToOCS(`cloud/users/${userid}`, 2))
                .then((response) => context.commit('addUserData', response))
                .catch((error) => context.commit('API_FAILURE', { userid, error }));
        });
    },

    /** Enable or disable user 
     * 
     * @param {Object} context
     * @param {Object} options
     * @param {string} options.userid User id
     * @param {boolean} options.enabled User enablement status
     * @returns {Promise}
     */
    enableDisableUser(context, { userid, enabled = true }) {
        let userStatus = enabled ? 'enable' : 'disable';
        return api.requireAdmin().then((response) => {
            return api.put(OC.linkToOCS(`cloud/users/${userid}/${userStatus}`, 2))
                .then((response) => context.commit('enableDisableUser', { userid, enabled }))
                .catch((error) => context.commit('API_FAILURE', { userid, error }));
        });
    },

    /**
     * Edit user data
     * 
     * @param {Object} context 
     * @param {Object} options
     * @param {string} options.userid User id
     * @param {string} options.key User field to edit
     * @param {string} options.value Value of the change
     * @returns {Promise}
     */
    setUserData(context, { userid, key, value }) {
        if (['email', 'quota', 'displayname', 'password'].indexOf(key) !== -1) {
            // We allow empty email or displayname
            if (typeof value === 'string' &&
                (
                    (['quota', 'password'].indexOf(key) !== -1 && value.length > 0) ||
                    ['email', 'displayname'].indexOf(key) !== -1
                )
            ) {
                return api.requireAdmin().then((response) => {
                    return api.put(OC.linkToOCS(`cloud/users/${userid}`, 2), { key: key, value: value })
                        .then((response) => context.commit('setUserData', { userid, key, value }))
                        .catch((error) => context.commit('API_FAILURE', { userid, error }));
                });
            }
        }
        return Promise.reject(new Error('Invalid request data'));
    }
};

export default { state, mutations, getters, actions };