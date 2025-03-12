import Api from './Api';
class UserService {
    async CreateUser(user) {
        let url = '/api/user/createUser';
        return Api.fetch(url, {
            method: 'POST',
            body: JSON.stringify({ user: user })
        });
    }
}

export default new UserService();