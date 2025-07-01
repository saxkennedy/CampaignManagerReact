import Api from './Api';
class UserService {
    callbacks = [];

    //async CreateUser(user) {
    //    let url = '/api/user/createUser';
    //    return Api.fetch(url, {
    //        method: 'POST',
    //        body: JSON.stringify({ Email: user.Email, Password: user.Password, FirstName: user.FirstName, LastName: user.LastName })
    //    });
    //}
    //
    //async GetUser(email, password) {
    //    return Api.fetch(`/api/user/getUser/${email}/${password}`);
    //}
    async GetUser(email, password) {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        if (response.ok) {
            console.log("Success:", result.message);
        }
        else {
            console.error("Error:", result.message);
        }
    }
}

export default new UserService();
