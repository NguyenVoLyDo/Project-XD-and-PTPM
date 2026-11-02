export interface ApiErrorDetail {
  field?: string;
  code?: string;
  message?: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details: ApiErrorDetail[];
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}
