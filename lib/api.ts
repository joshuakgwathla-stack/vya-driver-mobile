import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { API_URL } from '../constants'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken')
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken })
        await SecureStore.setItemAsync('accessToken', data.data.accessToken)
        await SecureStore.setItemAsync('refreshToken', data.data.refreshToken)
        original.headers.Authorization = `Bearer ${data.data.accessToken}`
        return api(original)
      } catch {
        await SecureStore.deleteItemAsync('accessToken')
        await SecureStore.deleteItemAsync('refreshToken')
      }
    }
    return Promise.reject(error)
  }
)

export default api

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
}

export const driverApi = {
  getProfile: () => api.get('/driver/profile'),
  updateProfile: (data: FormData) =>
    api.patch('/driver/profile', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getVehicles: () => api.get('/driver/vehicles'),
  updateVehicle: (id: string, data: FormData) =>
    api.patch(`/driver/vehicles/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getEarnings: (params?: any) => api.get('/driver/earnings', { params }),
}

export const queueApi = {
  // route_id, vehicle_id, slot_date (YYYY-MM-DD), slot_time (HH:MM)
  join: (data: { route_id: string; vehicle_id: string; slot_date: string; slot_time: string }) =>
    api.post('/trips/queue', data),
  // Cancel a queued trip to effectively leave the queue
  cancelTrip: (tripId: string) => api.post(`/trips/${tripId}/cancel`),
  // Returns upcoming scheduled trips for this driver
  getMyQueue: () => api.get('/trips/queue/mine'),
  // Slot occupancy for a route + date
  getSlotOccupancy: (params: { route_id: string; date: string }) =>
    api.get('/trips/slots', { params }),
}

export const tripsApi = {
  getMyTrips: (params?: any) => api.get('/trips/my', { params }),
  getTrip: (id: string) => api.get(`/trips/${id}`),
  getPassengers: (tripId: string) => api.get(`/driver/trips/${tripId}/bookings`),
  updateStatus: (tripId: string, status: string) =>
    api.patch(`/trips/${tripId}/status`, { status }),
}

export const routesApi = {
  getAll: () => api.get('/routes'),
  getCities: () => api.get('/routes/cities'),
}

export const messagesApi = {
  getMessages: (bookingId: string) => api.get(`/messages/${bookingId}`),
  sendMessage: (bookingId: string, content: string) =>
    api.post(`/messages/${bookingId}`, { content }),
}

export const usersApi = {
  updateProfile: (data: FormData) =>
    api.patch('/users/profile', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  changePassword: (data: any) => api.patch('/users/password', data),
  getNotifications: (params?: any) => api.get('/users/notifications', { params }),
  markNotificationRead: (id: string) => api.patch(`/users/notifications/${id}/read`),
  markAllRead: () => api.patch('/users/notifications/read-all'),
}
