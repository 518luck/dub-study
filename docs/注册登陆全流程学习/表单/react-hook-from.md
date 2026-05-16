# react-hook-form

## 先记住这几个概念

- `useForm()`：创建表单控制器
- `register()`：把输入框注册到表单里
- `handleSubmit()`：包装提交逻辑
- `formState.errors`：拿校验错误
- `watch()`：实时观察字段值
- `setValue()` / `getValues()`：手动读写表单值
- `reset()`：重置表单

## 一个最小例子

```ts
import { useForm } from "react-hook-form";

type FormValues = {
  email: string;
  password: string;
};

export default function DemoForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        type="email"
        {...register("email", { required: "Email is required" })}
      />
      {errors.email && <p>{errors.email.message}</p>}

      <input
        type="password"
        {...register("password", {
          required: "Password is required",
          minLength: { value: 8, message: "At least 8 characters" },
        })}
      />
      {errors.password && <p>{errors.password.message}</p>}

      <button type="submit" disabled={isSubmitting}>
        Submit
      </button>
    </form>
  );
}
```

## 常用 API

`useForm()` 最常用返回值：

- `register(name, rules?)`
  把字段接入表单。通常写成 `{...register("email")}`。
- `handleSubmit(onValid, onInvalid?)`
  提交时先校验，通过才调用 `onValid(data)`。
- `formState.errors`
  所有错误对象。
- `watch(name?)`
  看当前字段值，适合做联动 UI。
- `getValues(name?)`
  直接读取当前值，不触发重新渲染。
- `setValue(name, value, options?)`
  手动改值。
- `reset(values?)`
  重置表单。
- `control`
  给复杂组件或 `Controller` 用。
- `setError(name, error)`
  手动设置错误。
- `clearErrors(name?)`
  清空错误。

## register 常见校验规则

```tsx
register("email", {
  required: "Email is required",
  pattern: {
    value: /\S+@\S+\.\S+/,
    message: "Invalid email",
  },
});
```

## 什么时候用 Controller

如果组件不是原生 `input` 风格，不能直接吃 `ref/onChange/name`，就用 `Controller`。

比如一些日期选择器、下拉库、富文本编辑器。

```tsx
import { Controller, useForm } from "react-hook-form";

<Controller
  name="country"
  control={control}
  render={({ field, fieldState }) => (
    <CustomSelect
      value={field.value}
      onChange={field.onChange}
      error={fieldState.error?.message}
    />
  )}
/>;
```

如果组件支持直接透传原生输入属性，优先 `register`，更简单。

## 易错点

1. 不要把 `defaultValues` 和后续动态数据混为一谈。  
   `defaultValues` 只在初始化时生效。异步拿到数据后想更新表单，要用 `reset()`。
2. 不要忘了 `handleSubmit`。  
   下面这种是错的：

   ```tsx
   <form onSubmit={onSubmit}>
   ```

   通常应该是：

   ```tsx
   <form onSubmit={handleSubmit(onSubmit)}>
   ```

3. `register` 只能直接用在能接收原生表单属性的组件上。  
   如果你的自定义组件没把 `ref/onChange/name/value` 传下去，表单就接不上。
4. `disabled` 字段提交时通常不会出现在表单值里。  
   如果只是想不让用户改，但还想保留值，很多时候该用 `readOnly`。
5. `watch()` 会触发渲染，`getValues()` 不会。  
   想根据当前值渲染 UI，用 `watch`。  
   只是提交前顺手读一下，用 `getValues`。
6. 表单错误来源要分清。  
   有两类：

   - 前端规则错误
   - 后端返回错误

   不要以为 `errors` 一定只来自前端。

7. 条件渲染字段时，注意字段是否保留。  
   字段卸载后值要不要保留，要结合配置和业务看，不然容易出现“UI 消失了但值还在”这种情况。

## 建议的学习顺序

先只学这 5 个就够了：

1. `useForm`
2. `register`
3. `handleSubmit`
4. `formState.errors`
5. `reset`

学会这几个后，再看：

- `watch`
- `setValue`
- `Controller`
- `FormProvider / useFormContext`

---

## 项目里怎么用

你这个项目中的关键文件是 `apps/web/ui/auth/register/signup-email.tsx:16`。

先看初始化：

```tsx
const form = useForm<SignUpProps>({
  defaultValues: {
    email,
  },
});
```

这里做了两件事：

- 用 `useForm()` 创建表单
- 默认把 context 里的 `email` 填进去

然后把常用能力解构出来：

```tsx
const {
  register,
  handleSubmit,
  formState: { errors },
  getValues,
} = form;
```

这里说明这个页面主要依赖 4 个能力：

- `register`：绑定输入框
- `handleSubmit`：处理提交
- `errors`：拿错误
- `getValues`：读取当前输入值

邮箱输入框这一段：

```tsx
<Input
  type="email"
  ...
  {...register("email")}
  error={errors.email?.message}
/>
```

意思是：

- `register("email")` 把这个输入框注册为 `email` 字段
- `errors.email?.message` 把错误文案展示到 UI 上

密码输入框同理：

```tsx
<Input
  type="password"
  ...
  {...register("password")}
  error={errors.password?.message}
/>
```

提交逻辑比较特别，在 `apps/web/ui/auth/register/signup-email.tsx:52`：

```tsx
const onSubmit = useCallback(
  (e: FormEvent) => {
    const { email, password } = getValues();

    if (email && !password && !showPassword) {
      e.preventDefault();
      e.stopPropagation();
      setShowPassword(true);
      return;
    }

    handleSubmit(async (data) => await executeAsync(data))(e);
  },
  [getValues, showPassword, handleSubmit, executeAsync],
);
```

这段不是最基础的写法，它做了一个“两步提交”：

- 第一次点提交，如果只填了邮箱，就先展开密码框
- 第二次再真正提交到服务端

也就是说，它没有直接写：

```tsx
<form onSubmit={handleSubmit(onSubmit)}>
```

而是自己包了一层逻辑，再在里面手动调用：

```tsx
handleSubmit(async (data) => await executeAsync(data))(e);
```

这是 `react-hook-form` 的一个常见高级用法：  
你可以在真正校验提交前，先做自己的 UI 分支判断。

再看这一段：

```tsx
<FormProvider {...form}>
  <PasswordRequirements />
</FormProvider>
```

这里说明 `PasswordRequirements` 这个子组件也需要访问当前表单，所以用了 `FormProvider` 把整个 `form` 往下传。  
这样子组件内部可以用 `useFormContext()` 读表单，而不用一层层传 `props`。

所以这个项目里的 `react-hook-form` 使用方式可以总结成：

- `useForm()` 建表单
- `register()` 绑定 `Input`
- `errors.xxx?.message` 显示错误
- `getValues()` 在提交前读当前值
- `handleSubmit()` 负责最终表单校验和数据收集
- `FormProvider` 把表单能力共享给更深层组件

---

## 把项目这段翻译成人话

这个页面的流程其实是：

1. 建一个注册表单，默认带上可能已经输入过的邮箱
2. 邮箱框注册成 `email`
3. 密码框注册成 `password`
4. 用户点击提交
5. 如果还没展示密码框，就先展示密码框
6. 如果已经有完整数据，就交给 `react-hook-form` 收集并提交
7. 子组件 `PasswordRequirements` 通过表单上下文读取密码状态

---
