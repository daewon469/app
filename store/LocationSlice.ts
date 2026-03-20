import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type LocationState = {
  work_lat?: number;
  work_lng?: number;
  work_address?: string;
  work_zoom?: number;
  business_lat?: number;
  business_lng?: number;
  business_address?: string;
  business_zoom?: number;
};

const initialState: LocationState = { 
  work_lat: 37.5665,   
  work_lng: 126.9780, 
  work_zoom: 15,
  work_address :"",
  business_lat: 37.4979,   
  business_lng: 127.0276, 
  business_zoom: 15,
  business_address :""
 };

const locationSlice = createSlice({
  name: "location",
  initialState,
  reducers: {
    setWorkLocation(state, action: PayloadAction<LocationState>) {
      state.work_lat = action.payload.work_lat;
      state.work_lng = action.payload.work_lng;
      state.work_address = action.payload.work_address;
      state.work_zoom = action.payload.work_zoom ?? state.work_zoom ?? 15;
    },
    setBusinessLocation(state, action: PayloadAction<LocationState>) {
      state.business_lat = action.payload.business_lat;
      state.business_lng = action.payload.business_lng;
      state.business_address = action.payload.business_address;
      state.business_zoom = action.payload.business_zoom ?? state.business_zoom ?? 15;
    },
    clearLocation() {
      return initialState;
    },
  },
});

export const { setWorkLocation, setBusinessLocation ,clearLocation } = locationSlice.actions;
export default locationSlice.reducer;
