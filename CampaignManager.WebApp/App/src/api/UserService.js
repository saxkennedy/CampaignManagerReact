import Api from './Api';
class UserService {
    callbacks = [];

    async CreateUser(user) {
        let url = '/api/user/createUser';
        return Api.fetch(url, {
            method: 'POST',
            body: JSON.stringify({ user: user })
        });
    }

    async GetUser(email, password) {
        return Api.fetch('/api/user/getUser/${email}/${password}');
    }
}

export default new UserService();