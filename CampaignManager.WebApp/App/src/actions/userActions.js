import { GET_USER, CREATE_USER } from '../constants/userConstants'
import UserService from '../api/UserService'

// Action to create a user
export const createUser = (user) => async (dispatch) => {
    try {
        const response = await UserService.CreateUser(user);
        dispatch({
            type: CREATE_USER,
            payload: response
        });
    } catch (error) {
        console.error(error);
    }
}
// Action to get a user
export const getUser = (email, password) => async (dispatch) => {
    try {
        const response = await UserService.GetUser(email, password);
        dispatch({
            type: GET_USER,
            payload: response
        });
    } catch (error) {
        console.error(error);
    }
}