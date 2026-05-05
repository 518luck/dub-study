next-safe-action
负责把前端提交和服务端 action 安全连起来。
比如前端的 useAction(sendOtpAction)，服务端的
actionClient.inputSchema(...).action(...)。
zod
负责定义数据结构和校验规则。
比如 signUpSchema、emailSchema、passwordSchema 这些。
react-hook-form
负责前端表单状态管理，比如字段注册、取值、提交、错误状态。
你看到的 useForm()、register("email")、handleSubmit() 都是它的。
