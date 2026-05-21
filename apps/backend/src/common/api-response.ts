export interface ApiResponse<T> {
  success: true;
  data: T;
  message: string;
}

export interface PaginatedData<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export function ok<T>(data: T, message = "OK"): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}
