export type MetaErrorCode =
  | 'META_TOKEN_MISSING'
  | 'META_TOKEN_INVALID'
  | 'META_PERMISSION_DENIED'
  | 'META_RATE_LIMITED'
  | 'META_NETWORK_ERROR'
  | 'META_API_ERROR'
  | 'META_STORAGE_UNAVAILABLE'
  | 'META_VALIDATION_ERROR';

export class MetaError extends Error {
  readonly code: MetaErrorCode;

  constructor(code: MetaErrorCode, message: string) {
    super(message);
    this.name = 'MetaError';
    this.code = code;
  }
}

export function toVietnameseMetaMessage(code: MetaErrorCode): string {
  const messages = {
    META_TOKEN_MISSING: 'Vui lòng lưu Access Token phát triển trước khi kết nối Meta.',
    META_TOKEN_INVALID: 'Access Token không hợp lệ hoặc đã hết hạn.',
    META_PERMISSION_DENIED: 'Ứng dụng chưa có quyền truy cập cần thiết.',
    META_RATE_LIMITED: 'Meta đang giới hạn tần suất yêu cầu. Vui lòng thử lại sau.',
    META_NETWORK_ERROR: 'Không thể kết nối đến Meta. Vui lòng kiểm tra kết nối mạng.',
    META_API_ERROR: 'Meta Graph API trả về lỗi. Vui lòng kiểm tra token và quyền truy cập.',
    META_STORAGE_UNAVAILABLE:
      'Thiết bị hiện không hỗ trợ lưu token an toàn. Access Token chưa được lưu.',
    META_VALIDATION_ERROR: 'Dữ liệu Meta trả về không đúng định dạng mong đợi.'
  } satisfies Record<MetaErrorCode, string>;

  return messages[code];
}

export function normalizeGraphError(status: number, graphCode?: number): MetaErrorCode {
  if (status === 401 || graphCode === 190) {
    return 'META_TOKEN_INVALID';
  }

  if (status === 403 || graphCode === 10 || graphCode === 200 || graphCode === 283) {
    return 'META_PERMISSION_DENIED';
  }

  if (status === 429 || graphCode === 4 || graphCode === 17 || graphCode === 32) {
    return 'META_RATE_LIMITED';
  }

  return 'META_API_ERROR';
}

export function toMetaError(error: unknown): MetaError {
  if (error instanceof MetaError) {
    return error;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new MetaError('META_NETWORK_ERROR', 'Meta request timed out.');
  }

  if (error instanceof TypeError) {
    return new MetaError('META_NETWORK_ERROR', 'Meta request failed.');
  }

  return new MetaError('META_API_ERROR', 'Unexpected Meta integration failure.');
}
