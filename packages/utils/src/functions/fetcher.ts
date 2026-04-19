interface SWRError extends Error {
  info: any;
  status: number;
}

// fetcher的最小实现
// 对于带有 JSON 数据的普通 RESTful API，首先需要创建一个fetcher函数，它只是本机的包装fetch:
// const fetcher = (...args) => fetch(...args).then(res => res.json())

export async function fetcher<JSON = any>(
  input: RequestInfo,// 请求目标
  init?: RequestInit & { headers?: Record<string, string> },// &类型合并
): Promise<JSON> {
  const res = await fetch(input, {
    ...init,
    ...(init?.headers && { headers: init.headers }),
  });

  // res.ok 是 fetch 响应对象上的一个布尔值。
  if (!res.ok) {
    const message =
      (await res.json())?.error?.message ||
      "An error occurred while fetching the data.";
    const error = new Error(message) as SWRError;
    error.info = message;
    error.status = res.status;

    throw error;
  }

  return res.json();
}
