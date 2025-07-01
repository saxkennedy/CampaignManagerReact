import Api from './Api';
class UserService {
    callbacks = [];

    async CreateUser(user) {
        let url = '/api/user/createUser';
        return Api.fetch(url, {
            method: 'POST',
            body: JSON.stringify({ Email: user.Email, Password: user.Password, FirstName: user.FirstName, LastName: user.LastName })
        });
    }

    async GetUser(email, password) {
        return Api.fetch(`/api/user/getUser/${email}/${password}`);
    }
}

export default new UserService();