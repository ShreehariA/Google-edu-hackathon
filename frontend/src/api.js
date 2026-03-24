import axios from 'axios'

const API = axios.create({ 
  baseURL: window.location.origin
})

export const register     = (email, password)      => API.post('/register', { email, password })
export const login        = (email, password)      => API.post('/login', { email, password })
export const getSubjects  = (studentId)            => API.get(`/student/${studentId}/subjects`)
export const getDashboard = (studentId, subjectId) => API.get(`/student/${studentId}/dashboard?subject_id=${subjectId}`)
export const getLeaderboard = ()                   => API.get('/leaderboard')
export const getMyRank    = (studentId)            => API.get(`/student/${studentId}/leaderboard-rank`)
