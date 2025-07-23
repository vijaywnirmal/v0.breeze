"use client"

import { useState, useEffect } from "react"
import { LoginForm } from "@/components/login-form"
import { Dashboard } from "@/components/dashboard"

interface UserData {
  user_name: string
  userid: string
  funds: any
  credentials: {
    api_key: string
    api_secret: string
    session_token: string
  }
}

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in (stored in localStorage)
    const storedUserData = localStorage.getItem("breezeUserData")
    if (storedUserData) {
      try {
        const parsedData = JSON.parse(storedUserData)
        setUserData(parsedData)
        setIsLoggedIn(true)
      } catch (error) {
        console.error("Error parsing stored user data:", error)
        localStorage.removeItem("breezeUserData")
      }
    }
    setIsLoading(false)
  }, [])

  const handleLogin = (data: UserData) => {
    setUserData(data)
    setIsLoggedIn(true)
    localStorage.setItem("breezeUserData", JSON.stringify(data))
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setUserData(null)
    localStorage.removeItem("breezeUserData")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {!isLoggedIn ? <LoginForm onLogin={handleLogin} /> : <Dashboard userData={userData!} onLogout={handleLogout} />}
    </main>
  )
}
