export type UserCreate = {
    username: string;
    email: string;
    password: string;
    role: string;
};

export type UserLogin = {
    username: string;
    password: string;
};