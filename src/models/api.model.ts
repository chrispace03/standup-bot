export interface ApiErrorResponse {
  error: string;
  statusCode: number;
}

export interface HealthCheckResponse {
  status: 'ok';
  timestamp: string;
  version: string;
  environment: string;
}
