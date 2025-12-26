// Main BaseUrl
export const backendApi = {
    // baseUrl: "http://127.0.0.1:8080",
    // baseUrl: "http://192.168.1.8:8080",
    
    // baseUrl: "https://shudh-all-backend.onrender.com",
    baseUrl: "https://shudh-all-backend-docker-295884782547.asia-south1.run.app",
};
 
// ===================== Data Route Urls ==========================================================
// Manholes - Somajiguda
backendApi.manholeData = `${backendApi.baseUrl}/database/table/somajiguda_manholes_data?limit=3000`;
// Robot Operations - Somajiguda
backendApi.robotData = `${backendApi.baseUrl}/database/table/somajiguda_operations_data?limit=120000`;
// Ward Co-ordiantes with lat,long's
backendApi.warddata = `${backendApi.baseUrl}/database/table/ward_coordinates`;
// Weather of Area wize from area centroid lat,long of all manholes
backendApi.weatherdata = `${backendApi.baseUrl}/weather/area/somajiguda`;
// All Robot Operations - All Areas
backendApi.operationsdata = `${backendApi.baseUrl}/database/table/data_operations`;
 
 
// ===================== Analytics Generating Route Urls =========================================================
backendApi.manholesReportUrl = `${backendApi.baseUrl}/analytics/analyze/manholes`;
backendApi.robotsReportUrl = `${backendApi.baseUrl}/analytics/analyze/robots`;
backendApi.wardsReportUrl = `${backendApi.baseUrl}/analytics/analyze/ward`;
 
 
// ===============================================================================
// Maintainence Data from Auto Analytics from All Operations Data
backendApi.maintainenceData = `${backendApi.baseUrl}/database/maintainence`;
 