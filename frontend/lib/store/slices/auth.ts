import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export interface AuthState {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  role: string;
  updated_at: string;
  created_at: string;
  csrfToken: string;
}

const initialState: AuthState = {
  id: 0,
  username: "",
  email: "",
  is_active: false,
  role: "",
  updated_at: "",
  created_at: "",
  csrfToken: "",
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<AuthState>) => {
      state.id = action.payload.id;
      state.username = action.payload.username;
      state.email = action.payload.email;
      state.is_active = action.payload.is_active;
      state.role = action.payload.role;
      state.updated_at = action.payload.updated_at;
      state.created_at = action.payload.created_at;
    },
    setCsrfToken: (state, action: PayloadAction<string>) => {
      state.csrfToken = action.payload;
    },
  },
});

// Action creators are generated for each case reducer function
export const { setUser, setCsrfToken } = authSlice.actions;

export default authSlice.reducer;
