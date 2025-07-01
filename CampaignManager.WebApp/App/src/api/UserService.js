import BackendApi from './BackendApi';
class UserService {
    callbacks = [];

    async CreateUser(user) {
        let url = '/backendApi/user/createUser';
        return BackendApi.fetch(url, {
            method: 'POST',
            body: JSON.stringify({ Email: user.Email, Password: user.Password, FirstName: user.FirstName, LastName: user.LastName })
        });
    }

    async GetUser(email, password) {
        return BackendApi.fetch(`/backendApi/user/getUser/${email}/${password}`);
    }
}

export default new UserService();