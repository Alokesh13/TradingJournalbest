import { useState } from "react"
import { supabase } from "../lib/supabase"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) alert(error.message)
    else alert("Login successful")
  }

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) alert(error.message)
    else alert("Account created. Check email.")
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm mx-auto mt-40">
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2"
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2"
      />

      <button onClick={handleLogin} className="bg-black text-white p-2">
        Login
      </button>

      <button onClick={handleSignup} className="border p-2">
        Sign Up
      </button>
    </div>
  )
}
