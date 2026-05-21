// Common API envelope shapes from team17_mongodb_api_spec.md §3.

export type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type PaginatedData<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
};

export type PaginationQuery = {
  page?: number;
  limit?: number;
};
