// リトライ処理ユーティリティ

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * 指数バックオフによる遅延時間を計算
 * @param attempt 試行回数（0始まり）
 * @param baseDelayMs 基本遅延時間
 * @param maxDelayMs 最大遅延時間
 * @returns 遅延時間（ミリ秒）
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  // 指数バックオフ + ジッター
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelayMs;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * リトライ可能なエラーかどうかを判定
 * @param error エラーオブジェクト
 * @returns リトライ可能な場合true
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  // ネットワークエラー
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('socket')
  ) {
    return true;
  }

  // レート制限エラー（429）
  if (message.includes('429') || message.includes('rate limit')) {
    return true;
  }

  // サーバーエラー（5xx）
  if (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504')
  ) {
    return true;
  }

  // Axiosエラーの場合
  if ('code' in error) {
    const code = (error as { code?: string }).code;
    if (
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNREFUSED'
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 指定時間待機
 * @param ms 待機時間（ミリ秒）
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 指数バックオフでリトライを実行
 * @param fn 実行する非同期関数
 * @param options リトライオプション
 * @returns 関数の実行結果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const shouldRetry = opts.shouldRetry || isRetryableError;

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 最後の試行またはリトライ不可能なエラーの場合はスロー
      if (attempt === opts.maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // 次の試行まで待機
      const delay = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
      console.warn(
        `リトライ ${attempt + 1}/${opts.maxRetries}: ${delay}ms後に再試行します`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}
