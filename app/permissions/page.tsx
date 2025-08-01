"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Camera,
  Shield,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Mic,
  Activity,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Eye,
} from "lucide-react"

type PermissionState = "pending" | "granted" | "denied" | "unavailable" | "checking"
type ErrorType = "no_camera" | "no_microphone" | "blocked" | "not_supported" | "unknown"

export default function PermissionsPage() {
  const [permissionState, setPermissionState] = useState<PermissionState>("pending")
  const [isRequesting, setIsRequesting] = useState(false)
  const [errorType, setErrorType] = useState<ErrorType | null>(null)
  const [deviceInfo, setDeviceInfo] = useState({
    hasCamera: false,
    hasMicrophone: false,
    isSupported: false,
  })

  useEffect(() => {
    checkDeviceCapabilities()
  }, [])

  const checkDeviceCapabilities = async () => {
    setPermissionState("checking")

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorType("not_supported")
        setPermissionState("unavailable")
        return
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      const hasCamera = devices.some((device) => device.kind === "videoinput")
      const hasMicrophone = devices.some((device) => device.kind === "audioinput")

      setDeviceInfo({
        hasCamera,
        hasMicrophone,
        isSupported: true,
      })

      if (!hasCamera && !hasMicrophone) {
        setErrorType("no_camera")
        setPermissionState("unavailable")
      } else {
        setPermissionState("pending")
      }
    } catch (error) {
      console.error("Error checking device capabilities:", error)
      setErrorType("unknown")
      setPermissionState("unavailable")
    }
  }

  const requestPermissions = async () => {
    setIsRequesting(true)
    setErrorType(null)

    try {
      const constraints: MediaStreamConstraints = {}

      if (deviceInfo.hasCamera) {
        constraints.video = {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: "user",
          frameRate: { ideal: 30, min: 15 },
        }
      }

      if (deviceInfo.hasMicrophone) {
        constraints.audio = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      }

      if (!constraints.video && !constraints.audio) {
        setErrorType("no_camera")
        setPermissionState("unavailable")
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      stream.getTracks().forEach((track) => track.stop())

      setPermissionState("granted")

      setTimeout(() => {
        window.location.href = "/detection"
      }, 1500)
    } catch (error: any) {
      console.error("Permission error:", error)

      if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setErrorType("no_camera")
      } else if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setErrorType("blocked")
      } else if (error.name === "NotSupportedError") {
        setErrorType("not_supported")
      } else {
        setErrorType("unknown")
      }

      setPermissionState("denied")
    } finally {
      setIsRequesting(false)
    }
  }

  const getErrorMessage = () => {
    switch (errorType) {
      case "no_camera":
        return {
          title: "No Devices Found",
          message: "Please connect a camera or microphone to use YawnSense.",
          icon: <WifiOff className="w-8 h-8 text-red-400" />,
        }
      case "blocked":
        return {
          title: "Access Blocked",
          message: "Please enable camera and microphone permissions in your browser settings.",
          icon: <AlertTriangle className="w-8 h-8 text-orange-400" />,
        }
      case "not_supported":
        return {
          title: "Browser Not Supported",
          message: "Your browser does not support the required features for YawnSense.",
          icon: <AlertCircle className="w-8 h-8 text-red-400" />,
        }
      default:
        return {
          title: "Unknown Error",
          message: "An unexpected error occurred. Please try refreshing the page.",
          icon: <AlertCircle className="w-8 h-8 text-red-400" />,
        }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle background elements */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute opacity-10"
          animate={{
            y: [0, -20, 0],
            rotate: [0, 180, 360],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 6 + i,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
          style={{
            left: `${10 + i * 15}%`,
            top: `${15 + i * 10}%`,
          }}
        >
          {i % 2 === 0 && <Eye className="w-6 h-6 text-blue-400" />}
          {i % 2 === 1 && <Mic className="w-6 h-6 text-cyan-400" />}
        </motion.div>
      ))}

      <div className="max-w-lg w-full relative z-10">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-6">
          <Button
            variant="ghost"
            onClick={() => (window.location.href = "/")}
            className="text-blue-300 hover:text-white hover:bg-blue-800/30 transition-all duration-300 border border-blue-400/30"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <Card className="shadow-xl border-0 bg-gray-800/90 backdrop-blur-xl border-2 border-blue-400/30">
            <CardHeader className="text-center pb-6">
              <motion.div
                className="mx-auto w-24 h-24 bg-blue-700/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-sm border-2 border-blue-400/50"
                animate={{
                  scale: [1, 1.05, 1],
                  boxShadow: [
                    "0 0 15px rgba(59, 130, 246, 0.3)",
                    "0 0 30px rgba(59, 130, 246, 0.6)",
                    "0 0 15px rgba(59, 130, 246, 0.3)",
                  ],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              >
                <AnimatePresence mode="wait">
                  {permissionState === "checking" ? (
                    <motion.div
                      key="checking"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                    >
                      <RefreshCw className="w-10 h-10 text-blue-400 animate-spin" />
                    </motion.div>
                  ) : permissionState === "granted" ? (
                    <motion.div
                      key="granted"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                    >
                      <CheckCircle className="w-10 h-10 text-green-400" />
                    </motion.div>
                  ) : permissionState === "denied" || permissionState === "unavailable" ? (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                    >
                      {getErrorMessage().icon}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="pending"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="flex space-x-1"
                    >
                      <Eye className="w-6 h-6 text-blue-400" />
                      {deviceInfo.hasCamera && <Camera className="w-5 h-5 text-cyan-400" />}
                      {deviceInfo.hasMicrophone && <Mic className="w-5 h-5 text-purple-400" />}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <CardTitle className="text-3xl font-bold text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text mb-3">
                {permissionState === "checking"
                  ? "Checking Devices..."
                  : permissionState === "granted"
                    ? "Ready to Start!"
                    : permissionState === "denied" || permissionState === "unavailable"
                      ? getErrorMessage().title
                      : "Permissions Required"}
              </CardTitle>

              <CardDescription className="text-blue-200 text-lg">
                {permissionState === "checking"
                  ? "Detecting your camera and microphone..."
                  : permissionState === "granted"
                    ? "All systems are ready for yawn detection."
                    : permissionState === "denied" || permissionState === "unavailable"
                      ? getErrorMessage().message
                      : "YawnSense needs access to your camera and microphone to detect yawns."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Device Status */}
              {permissionState !== "checking" && permissionState !== "granted" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gray-700/40 border border-gray-600 rounded-xl p-4 backdrop-blur-sm"
                >
                  <h3 className="font-bold text-blue-300 mb-3 flex items-center text-lg">
                    <Activity className="w-5 h-5 mr-2" />
                    Device Status
                  </h3>
                  <div className="space-y-3 text-base">
                    <div className="flex items-center justify-between p-2 bg-gray-900/20 rounded-lg">
                      <span className="text-blue-300 flex items-center">
                        <Camera className="w-4 h-4 mr-2" />
                        Camera:
                      </span>
                      <span className={`font-bold ${deviceInfo.hasCamera ? "text-green-400" : "text-red-400"}`}>
                        {deviceInfo.hasCamera ? "Detected" : "Not Found"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-900/20 rounded-lg">
                      <span className="text-blue-300 flex items-center">
                        <Mic className="w-4 h-4 mr-2" />
                        Microphone:
                      </span>
                      <span className={`font-bold ${deviceInfo.hasMicrophone ? "text-green-400" : "text-red-400"}`}>
                        {deviceInfo.hasMicrophone ? "Detected" : "Not Found"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-900/20 rounded-lg">
                      <span className="text-blue-300 flex items-center">
                        <Activity className="w-4 h-4 mr-2" />
                        Browser Support:
                      </span>
                      <span className={`font-bold ${deviceInfo.isSupported ? "text-green-400" : "text-red-400"}`}>
                        {deviceInfo.isSupported ? "Compatible" : "Not Supported"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Privacy Info */}
              {(permissionState === "pending" || permissionState === "denied") && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-green-900/30 border border-green-700 rounded-xl p-4 backdrop-blur-sm"
                >
                  <div className="flex items-start space-x-3">
                    <Shield className="w-6 h-6 text-green-400 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-green-300 mb-2 text-lg">Privacy Assurance</h3>
                      <ul className="text-sm text-green-200 space-y-1">
                        <li>• Real-time analysis only</li>
                        <li>• No data storage or sharing</li>
                        <li>• All processing happens locally</li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Success Animation */}
              <AnimatePresence>
                {permissionState === "granted" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-green-900/40 border border-green-700 rounded-xl p-6 text-center backdrop-blur-sm"
                  >
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                    >
                      <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    </motion.div>
                    <p className="text-green-300 font-bold text-xl mb-2">Permissions Granted!</p>
                    <p className="text-green-200 mb-4">Loading YawnSense dashboard...</p>
                    <motion.div
                      className="h-2 bg-green-400/30 rounded-full overflow-hidden"
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1.5 }}
                    >
                      <motion.div
                        className="h-full bg-gradient-to-r from-green-400 to-blue-400"
                        initial={{ x: "-100%" }}
                        animate={{ x: "0%" }}
                        transition={{ duration: 1.5 }}
                      />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-4"
              >
                {permissionState === "pending" || permissionState === "denied" ? (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={requestPermissions}
                      disabled={isRequesting || permissionState === "unavailable"}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-xl font-bold rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRequesting ? (
                        <div className="flex items-center justify-center">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                            className="rounded-full h-6 w-6 border-b-2 border-white mr-3"
                          />
                          Requesting Access...
                        </div>
                      ) : permissionState === "unavailable" ? (
                        "Devices Unavailable"
                      ) : (
                        "Grant Permissions"
                      )}
                    </Button>
                  </motion.div>
                ) : null}

                {(permissionState === "denied" || permissionState === "unavailable") && (
                  <div className="flex space-x-3">
                    <Button
                      onClick={requestPermissions}
                      variant="outline"
                      className="flex-1 bg-transparent border-2 border-blue-400/40 text-blue-300 hover:bg-blue-800/30 hover:text-white transition-all duration-300"
                    >
                      🔄 Retry
                    </Button>
                    <Button
                      onClick={checkDeviceCapabilities}
                      variant="outline"
                      className="flex-1 bg-transparent border-2 border-gray-400/40 text-gray-300 hover:bg-gray-800/30 hover:text-white transition-all duration-300"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Scan Devices
                    </Button>
                  </div>
                )}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
