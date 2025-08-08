import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { User } from "@/types/User";

export interface UsersState {
  users: User[];
}

const initialState: UsersState = {
  users: [],
};

export const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    setUsers: (state, action: PayloadAction<User[]>) => {
      state.users = action.payload;
    },
    deleteUser: (state, action: PayloadAction<number>) => {
      state.users = state.users.filter((user) => user.id !== action.payload);
    },
    updateUser: (state, action: PayloadAction<User>) => {
      state.users = state.users.map((user) =>
        user.id === action.payload.id ? action.payload : user
      );
    },
  },
});

export const { setUsers, deleteUser, updateUser } = usersSlice.actions;
export default usersSlice.reducer;
