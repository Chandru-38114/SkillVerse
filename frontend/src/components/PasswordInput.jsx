import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordInput(props) {
  const [show, setShow] = useState(false);
  const { className = "input", ...rest } = props;
  
  return (
    <div className="relative flex items-center w-full">
      <input
        {...rest}
        className={`${className} pr-12 w-full`}
        type={show ? "text" : "password"}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-0 top-0 bottom-0 px-3 flex items-center justify-center text-ink/50 hover:text-ink/80 focus:outline-none min-w-[44px] z-10"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}
