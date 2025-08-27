import Api from './Api';
class UserService {
    callbacks = [];

    async CreateUser(user) {
        let url = '/api/createUser';
        return Api.fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Email: user.Email, Password: user.Password, FirstName: user.FirstName, LastName: user.LastName })
        });
    }
    
    async GetUser(email, password) {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        if (response.ok) {
            console.log("Success:", result.message);
            return result;
        }
        else {
            console.error("Error:", result.message);
        }
    }
}

export default new UserService();
