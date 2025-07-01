﻿const userReducer = (state = {} , action) => {
    switch (action.type) {
        case 'CREATE_USER':
            return {
                ...state,
                user: action.user
            }
        case 'GET_USER':
            return {
                ...state,
                user: action.user
            }
        default:
            return state;
    }
};

export default userReducer;
