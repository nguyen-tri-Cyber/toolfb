export type MetaErrorCode =
  | 'META_TOKEN_MISSING'
  | 'META_TOKEN_INVALID'
  | 'META_TOKEN_EXPIRED'
  | 'META_TOKEN_REVOKED'
  | 'META_PERMISSION_DENIED'
  | 'META_RATE_LIMITED'
  | 'META_NETWORK_ERROR'
  | 'META_API_ERROR'
  | 'META_PAGINATION_LIMIT'
  | 'META_STORAGE_UNAVAILABLE'
  | 'META_VALIDATION_ERROR'
  | 'META_OAUTH_UNCONFIGURED'
  | 'META_OAUTH_CANCELLED'
  | 'META_OAUTH_INVALID_CALLBACK'
  | 'META_OAUTH_IN_PROGRESS'
  | 'META_DEVELOPER_MODE_DISABLED'
  | 'SYNC_IN_PROGRESS'
  | 'SYNC_CANCELLED';

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
    META_TOKEN_MISSING: 'Vui lòng kết nối tài khoản Meta.',
    META_TOKEN_INVALID: 'Access Token không hợp lệ hoặc đã hết hạn.',
    META_TOKEN_EXPIRED: 'Phiên Meta đã hết hạn. Vui lòng kết nối lại.',
    META_TOKEN_REVOKED: 'Quyền truy cập Meta đã bị thu hồi. Vui lòng kết nối lại.',
    META_PERMISSION_DENIED: 'Ứng dụng chưa có quyền truy cập cần thiết.',
    META_RATE_LIMITED: 'Meta đang giới hạn tần suất yêu cầu. Vui lòng thử lại sau.',
    META_NETWORK_ERROR: 'Không thể kết nối đến Meta. Vui lòng kiểm tra kết nối mạng.',
    META_API_ERROR: 'Meta Graph API trả về lỗi. Vui lòng kiểm tra token và quyền truy cập.',
    META_PAGINATION_LIMIT: 'Dữ liệu từ Meta vượt giới hạn một lượt đồng bộ. Chưa đánh dấu đồng bộ hoàn tất.',
    META_STORAGE_UNAVAILABLE:
      'Thiết bị hiện không hỗ trợ lưu token an toàn. Access Token chưa được lưu.',
    META_VALIDATION_ERROR: 'Dữ liệu Meta trả về không đúng định dạng mong đợi.',
    META_OAUTH_UNCONFIGURED: 'Kết nối Meta chưa được cấu hình cho bản cài này.',
    META_OAUTH_CANCELLED: 'Đăng nhập Meta đã bị hủy hoặc hết thời gian chờ.',
    META_OAUTH_INVALID_CALLBACK: 'Phiên đăng nhập Meta không hợp lệ. Vui lòng thử lại.',
    META_OAUTH_IN_PROGRESS: 'Đang có một phiên đăng nhập Meta khác. Vui lòng chờ hoàn tất.',
    META_DEVELOPER_MODE_DISABLED: 'Chế độ Developer Token chỉ khả dụng trong môi trường phát triển (development).',
    SYNC_IN_PROGRESS: 'Trang này đang được đồng bộ. Vui lòng chờ hoặc hủy lượt hiện tại.',
    SYNC_CANCELLED: 'Đã hủy đồng bộ. Bạn có thể đồng bộ lại bất cứ lúc nào.'
  } satisfies Record<MetaErrorCode, string>;

  return messages[code];
}

export function normalizeGraphError(status: number, graphCode?: number, graphSubcode?: number): MetaErrorCode {
  if (graphCode === 190 && graphSubcode === 463) return 'META_TOKEN_EXPIRED';
  if (graphCode === 190 && [458, 459, 460, 467].includes(graphSubcode ?? -1)) return 'META_TOKEN_REVOKED';
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
