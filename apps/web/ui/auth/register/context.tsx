"use client";

import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useState,
} from "react";

interface RegisterContextType {
  email: string; //当前注册流程里保存的邮箱
  password: string; //password: string
  step: "signup" | "verify"; //当前注册流程走到哪一步了
  setEmail: (email: string) => void; //一个用来修改 email 的函数
  setPassword: (password: string) => void; //一个用来修改 password 的函数
  setStep: (step: "signup" | "verify") => void; //一个用来切换当前步骤的函数
  lockEmail?: boolean; //是否锁定邮箱输入框
}

const RegisterContext = createContext<RegisterContextType | undefined>(
  undefined,
);

export const RegisterProvider: React.FC<
  PropsWithChildren<{ email?: string; lockEmail?: boolean }>
> = ({ email: emailProp, lockEmail, children }) => {
  const [email, setEmail] = useState(emailProp ?? "");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"signup" | "verify">("signup");

  return (
    <RegisterContext.Provider
      value={{
        email,
        password, // 密码主要在验证密码格式的时候被消费
        step,
        setEmail,
        setPassword,
        setStep,
        lockEmail,
      }}
    >
      {children}
    </RegisterContext.Provider>
  );
};

export const useRegisterContext = () => {
  const context = useContext(RegisterContext);

  if (context === undefined) {
    throw new Error(
      "useRegisterContext must be used within a RegisterProvider",
    );
  }

  return context;
};
