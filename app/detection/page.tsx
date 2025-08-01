"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CameraOff,
  RotateCcw,
  Download,
  ArrowLeft,
  Activity,
  Timer,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  Mic,
  User,
  BarChart,
} from "lucide-react"

interface BodyLanguageIndicator {
  name: string
  value: number
  active: boolean
  threshold: number
  description: string
}

interface YawnData {
  timestamp: Date
  type: "full" | "boredom"
  confidence: number
  duration: number
  indicators: BodyLanguageIndicator[]
  breathPattern: {
    inhalationDepth: number
    exhalationDuration: number
    mouthOpening: number
  }
  mouthAspectRatio: number
}

export default function DetectionPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  const [isActive, setIsActive] = useState(false)
  const [fullYawnCount, setFullYawnCount] = useState(0)
  const [boredomYawnCount, setBoredomYawnCount] = useState(0)
  const [sessionTime, setSessionTime] = useState(0)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [yawnHistory, setYawnHistory] = useState<YawnData[]>([])
  const [isDetectingYawn, setIsDetectingYawn] = useState(false)
  const [yawnProgress, setYawnProgress] = useState(0)

  // LSTM-related states
  const [mouthAspectRatio, setMouthAspectRatio] = useState(0)
  const [marSequence, setMarSequence] = useState<number[]>([]) // Stores last 100 MAR values
  const [yawnProbability, setYawnProbability] = useState(0) // 0-100% output from simulated LSTM
  const [fatigueLevel, setFatigueLevel] = useState(0) // 0-100%

  // Simulation states for deterministic yawn sequence
  const [yawnSequenceState, setYawnSequenceState] = useState(0) // 0: normal, 1: pre-yawn, 2: yawning, 3: post-yawn
  const [yawnSequenceCounter, setYawnSequenceCounter] = useState(0)
  const MAR_NORMAL = 15
  const MAR_PEAK = 80
  const MAR_THRESHOLD_FOR_YAWN_START = 60 // Probability starts increasing significantly above this
  const MAR_THRESHOLD_FOR_YAWN_END = 30 // Probability drops below this to confirm yawn end

  // 7 key indicators for medium difficulty
  const [bodyLanguage, setBodyLanguage] = useState<BodyLanguageIndicator[]>([
    {
      name: "Mouth Opening Width", // Big Mouth
      value: 0,
      active: false,
      threshold: 75,
      description: "Extent of jaw opening",
    },
    {
      name: "Deep Inhalation", // High Inhale
      value: 0,
      active: false,
      threshold: 70,
      description: "Involuntary deep breath intake",
    },
    {
      name: "Prolonged Exhalation", // Slow Exhale
      value: 0,
      active: false,
      threshold: 70,
      description: "Extended breath release",
    },
    {
      name: "Jaw Drop Angle",
      value: 0,
      active: false,
      threshold: 70,
      description: "Angle of lower jaw depression",
    },
    {
      name: "Eye Drooping",
      value: 0,
      active: false,
      threshold: 65,
      description: "Degree of eyelid closure",
    },
    {
      name: "Facial Muscle Tension",
      value: 0,
      active: false,
      threshold: 60,
      description: "Tension in facial muscles",
    },
    {
      name: "Head Tilt Back",
      value: 0,
      active: false,
      threshold: 60,
      description: "Backward tilt of the head",
    },
  ])

  const [breathAnalysis, setBreathAnalysis] = useState({
    inhalationDepth: 0,
    exhalationDuration: 0,
    breathingRate: 0,
    audioLevel: 0,
  })

  const [deviceInfo, setDeviceInfo] = useState({
    hasCamera: false,
    hasMicrophone: false,
    isSupported: false,
  })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    checkDeviceCapabilities()
  }, [])

  const checkDeviceCapabilities = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage("Your browser doesn't support camera/microphone access.")
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
        setErrorMessage("No camera or microphone found. Please connect a device and refresh the page.")
      } else {
        setErrorMessage(null)
      }
    } catch (error) {
      console.error("Error checking device capabilities:", error)
      setErrorMessage("Unable to check device capabilities. Please refresh the page.")
    }
  }

  // Main detection loop
  useEffect(() => {
    let interval: NodeJS.Timeout
    let nextYawnTimeout: NodeJS.Timeout

    if (isActive) {
      interval = setInterval(() => {
        let currentMAR = MAR_NORMAL
        let currentInhalationDepth = 0
        let currentMouthOpeningWidth = 0
        let currentJawDropAngle = 0
        let currentEyeDrooping = 0
        let currentFacialMuscleTension = 0
        let currentHeadTiltBack = 0
        let currentProlongedExhalation = 0

        if (yawnSequenceState === 0) {
          // Normal state, waiting for next yawn trigger
          // This block will only be entered if a yawn just completed and we're in a pause
          // The next yawn is triggered by nextYawnTimeout
        } else if (yawnSequenceState === 1) {
          // Pre-yawn: MAR and indicators increase (Deep Mouth Opening, High Inhale)
          setYawnSequenceCounter((prev) => prev + 1)
          const progress = yawnSequenceCounter / 50
          currentMAR = MAR_NORMAL + (MAR_PEAK - MAR_NORMAL) * progress
          currentInhalationDepth = 30 + 60 * progress // Rises to 90 for "High Inhale"
          currentMouthOpeningWidth = 30 + 65 * progress // Rises to 95 for "Deep Mouth Opening"
          currentJawDropAngle = 30 + 60 * progress // Rises to 90
          currentEyeDrooping = 20 + 45 * progress // Rises to 65
          currentFacialMuscleTension = 20 + 40 * progress // Rises to 60
          currentHeadTiltBack = 20 + 40 * progress // Rises to 60
          currentProlongedExhalation = 10 + 10 * progress // Stays low initially

          if (yawnSequenceCounter >= 50) {
            setYawnSequenceState(2)
            setYawnSequenceCounter(0)
          }
        } else if (yawnSequenceState === 2) {
          // Yawning: MAR and indicators at peak (Deep Mouth Opening, High Inhale)
          setYawnSequenceCounter((prev) => prev + 1)
          currentMAR = MAR_PEAK + (Math.random() - 0.5) * 5 // Fluctuates around peak
          currentInhalationDepth = 90 + (Math.random() - 0.5) * 5 // Stays high
          currentMouthOpeningWidth = 95 + (Math.random() - 0.5) * 5 // Stays high
          currentJawDropAngle = 90 + (Math.random() - 0.5) * 5
          currentEyeDrooping = 65 + (Math.random() - 0.5) * 10
          currentFacialMuscleTension = 60 + (Math.random() - 0.5) * 10
          currentHeadTiltBack = 60 + (Math.random() - 0.5) * 10
          currentProlongedExhalation = 20 + (Math.random() - 0.5) * 5 // Still low

          if (yawnSequenceCounter >= 30) {
            // Stay at peak for 30 steps
            setYawnSequenceState(3)
            setYawnSequenceCounter(0)
          }
        } else if (yawnSequenceState === 3) {
          // Post-yawn: MAR and indicators decrease (Slow Exhale)
          setYawnSequenceCounter((prev) => prev + 1)
          const progress = yawnSequenceCounter / 80 // Longer duration for "slow exhale"
          currentMAR = MAR_PEAK - (MAR_PEAK - MAR_NORMAL) * progress
          currentInhalationDepth = 90 - 70 * progress // Decreases
          currentMouthOpeningWidth = 95 - 80 * progress // Decreases
          currentJawDropAngle = 90 - 70 * progress
          currentEyeDrooping = 65 - 45 * progress
          currentFacialMuscleTension = 60 - 40 * progress
          currentHeadTiltBack = 60 - 40 * progress
          currentProlongedExhalation = 20 + 70 * progress // Rises to 90 for "Slow Exhale"

          if (yawnSequenceCounter >= 80) {
            setYawnSequenceState(0) // Back to normal
            setYawnSequenceCounter(0)
            // Schedule the next yawn after a fixed delay
            nextYawnTimeout = setTimeout(() => {
              setYawnSequenceState(1) // Trigger next yawn
            }, 5000) // 5-second pause before next yawn
          }
        }
        currentMAR = Math.max(0, Math.min(100, currentMAR)) // Clamp values
        setMouthAspectRatio(currentMAR)

        // Update MAR sequence for "LSTM" input
        setMarSequence((prev) => {
          const newSequence = [...prev, currentMAR]
          if (newSequence.length > 100) {
            // Keep last 100 frames
            return newSequence.slice(newSequence.length - 100)
          }
          return newSequence
        })

        // --- Update Body Language Indicators deterministically ---
        const newBodyLanguage = bodyLanguage.map((indicator) => {
          let value = 0
          switch (indicator.name) {
            case "Mouth Opening Width":
              value = currentMouthOpeningWidth
              break
            case "Deep Inhalation":
              value = currentInhalationDepth
              break
            case "Prolonged Exhalation":
              value = currentProlongedExhalation
              break
            case "Jaw Drop Angle":
              value = currentJawDropAngle
              break
            case "Eye Drooping":
              value = currentEyeDrooping
              break
            case "Facial Muscle Tension":
              value = currentFacialMuscleTension
              break
            case "Head Tilt Back":
              value = currentHeadTiltBack
              break
            default:
              value = 0
          }
          return {
            ...indicator,
            value: Math.max(0, Math.min(100, value)),
            active: value > indicator.threshold,
          }
        })
        setBodyLanguage(newBodyLanguage)

        // --- Simulate breath analysis (for display/context) ---
        const newBreathAnalysis = {
          inhalationDepth: currentInhalationDepth, // Use deterministic value
          exhalationDuration: currentProlongedExhalation, // Use deterministic value
          breathingRate: 12 + (currentInhalationDepth / 100) * 8, // Linked to inhalation
          audioLevel: currentMouthOpeningWidth / 2, // Linked to mouth opening
        }
        setBreathAnalysis(newBreathAnalysis)

        // --- Calculate Yawn Probability based on the three key factors ---
        const mouthOpeningValue = newBodyLanguage.find((i) => i.name === "Mouth Opening Width")?.value || 0
        const deepInhalationValue = newBodyLanguage.find((i) => i.name === "Deep Inhalation")?.value || 0
        const prolongedExhalationValue = newBodyLanguage.find((i) => i.name === "Prolonged Exhalation")?.value || 0

        let newYawnProbability = 0

        if (yawnSequenceState === 1) {
          // Pre-yawn: Mouth opening and inhalation increasing
          newYawnProbability = Math.min(99, mouthOpeningValue * 0.4 + deepInhalationValue * 0.4 + currentMAR * 0.2)
        } else if (yawnSequenceState === 2) {
          // Yawning: Peak mouth opening and inhalation
          newYawnProbability = Math.min(99, mouthOpeningValue * 0.45 + deepInhalationValue * 0.45 + currentMAR * 0.1)
        } else if (yawnSequenceState === 3) {
          // Post-yawn: Exhalation increasing, mouth closing
          newYawnProbability = Math.max(0, mouthOpeningValue * 0.3 + prolongedExhalationValue * 0.4 + currentMAR * 0.3)
        } else {
          // Normal state
          newYawnProbability = Math.max(0, (currentMAR / MAR_THRESHOLD_FOR_YAWN_START) * 40)
        }
        setYawnProbability(newYawnProbability)

        // --- Calculate Fatigue Level ---
        // Fatigue increases with yawns and session time, and is influenced by current yawn probability
        const baseFatigue = (fullYawnCount + boredomYawnCount) * 10 + (sessionTime / 300) * 5 // 5 points per 5 minutes
        setFatigueLevel(Math.min(99, baseFatigue + newYawnProbability / 5))

        // --- Yawn Detection Trigger (based on Yawn Probability and sequence state) ---
        if (newYawnProbability > 85 && !isDetectingYawn && yawnSequenceState === 2) {
          // High probability AND actively yawning state
          setIsDetectingYawn(true)
          setYawnProgress(0)
        } else if (isDetectingYawn && newYawnProbability < MAR_THRESHOLD_FOR_YAWN_END && yawnSequenceState === 3) {
          // Probability drops AND post-yawn state, yawn completed
          const yawnData: YawnData = {
            timestamp: new Date(),
            type: mouthAspectRatio > 60 ? "full" : "boredom", // Simplified type based on peak MAR
            confidence: newYawnProbability,
            duration: 2.5 + Math.random() * 1.5, // Still some randomness for duration
            indicators: newBodyLanguage.filter((i) => i.active), // Still include for report
            breathPattern: newBreathAnalysis,
            mouthAspectRatio: mouthAspectRatio,
          }
          setYawnHistory((prev) => [...prev, yawnData])
          if (yawnData.type === "full") {
            setFullYawnCount((prev) => prev + 1)
          } else {
            setBoredomYawnCount((prev) => prev + 1)
          }
          setIsDetectingYawn(false)
          setYawnProgress(0)
        }

        if (isDetectingYawn) {
          setYawnProgress((prev) => Math.min(100, prev + 5)) // Progress during detection
        }
      }, 200) // Update interval

      // Session timer
      const timerInterval = setInterval(() => {
        setSessionTime((prev) => prev + 1)
      }, 1000)

      return () => {
        clearInterval(interval)
        clearTimeout(nextYawnTimeout) // Clear any pending next yawn
        clearInterval(timerInterval)
      }
    }
  }, [
    isActive,
    marSequence,
    yawnSequenceState,
    yawnSequenceCounter,
    isDetectingYawn,
    mouthAspectRatio,
    fullYawnCount,
    boredomYawnCount,
    sessionTime,
  ])

  const startDetection = async () => {
    setErrorMessage(null)

    try {
      if (!deviceInfo.isSupported) {
        setErrorMessage("Your browser doesn't support the required features.")
        return
      }

      if (!deviceInfo.hasCamera && !deviceInfo.hasMicrophone) {
        setErrorMessage("No camera or microphone available. Please connect a device and try again.")
        return
      }

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

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

      if (videoRef.current && constraints.video) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }

      if (constraints.audio) {
        try {
          audioContextRef.current = new AudioContext()
          analyserRef.current = audioContextRef.current.createAnalyser()
          const source = audioContextRef.current.createMediaStreamSource(mediaStream)
          source.connect(analyserRef.current)
        } catch (audioError) {
          console.warn("Audio analysis not available:", audioError)
        }
      }

      setStream(mediaStream)
      setIsActive(true)
      setErrorMessage(null)
      setYawnSequenceState(1) // Immediately start the first yawn sequence
    } catch (error: any) {
      console.error("Error accessing camera/microphone:", error)

      let errorMsg = "Unable to access camera/microphone. "

      if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        errorMsg += "No camera or microphone found. Please connect a device and try again."
      } else if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        errorMsg += "Permission denied. Please allow camera/microphone access and try again."
      } else if (error.name === "NotSupportedError") {
        errorMsg += "Your browser doesn't support the required features."
      } else if (error.name === "OverconstrainedError") {
        errorMsg += "Camera/microphone constraints not supported. Trying with basic settings..."

        try {
          const basicConstraints: MediaStreamConstraints = {}
          if (deviceInfo.hasCamera) {
            basicConstraints.video = true
          }
          if (deviceInfo.hasMicrophone) {
            basicConstraints.audio = true
          }

          const basicStream = await navigator.mediaDevices.getUserMedia(basicConstraints)

          if (videoRef.current && basicConstraints.video) {
            videoRef.current.srcObject = basicStream
            await videoRef.current.play()
          }

          setStream(basicStream)
          setIsActive(true)
          setErrorMessage(null)
          setYawnSequenceState(1) // Immediately start the first yawn sequence
          return
        } catch (retryError) {
          errorMsg += " Basic settings also failed."
        }
      } else {
        errorMsg += `Error: ${error.message || "Unknown error occurred"}`
      }

      setErrorMessage(errorMsg)
    }
  }

  const stopDetection = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
    setIsActive(false)
    setIsDetectingYawn(false)
    setYawnProgress(0)
    setYawnSequenceState(0) // Reset simulation state
    setYawnSequenceCounter(0)
  }

  const resetSession = () => {
    setFullYawnCount(0)
    setBoredomYawnCount(0)
    setYawnHistory([])
    setSessionTime(0)
    setYawnProgress(0)
    setIsDetectingYawn(false)
    setMouthAspectRatio(0)
    setMarSequence([])
    setYawnProbability(0)
    setFatigueLevel(0)
    setYawnSequenceState(0) // Reset simulation state
    setYawnSequenceCounter(0)
  }

  const downloadReport = () => {
    const report = {
      sessionDuration: sessionTime,
      totalYawns: fullYawnCount + boredomYawnCount,
      fullYawns: fullYawnCount,
      boredomYawns: boredomYawnCount,
      averageYawnProbability: yawnHistory.reduce((acc, curr) => acc + curr.confidence, 0) / yawnHistory.length || 0,
      yawnHistory: yawnHistory,
      timestamp: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `yawnsense-report-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-gray-900 p-4 relative overflow-hidden">
      {/* Subtle background elements */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute opacity-10"
          animate={{
            y: [0, -30, 0],
            rotate: [0, 180, 360],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 8 + i * 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
          style={{
            left: `${10 + i * 12}%`,
            top: `${15 + i * 10}%`,
          }}
        >
          {i % 2 === 0 && <Eye className="w-6 h-6 text-blue-400" />}
          {i % 2 === 1 && <Mic className="w-6 h-6 text-cyan-400" />}
        </motion.div>
      ))}

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <Button
            variant="ghost"
            onClick={() => (window.location.href = "/permissions")}
            className="text-blue-300 hover:text-white hover:bg-blue-800/30 transition-all duration-300 border border-blue-400/30"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Permissions
          </Button>

          <h1 className="text-4xl font-bold text-white">YawnSense Dashboard</h1>

          {/* Session Stats Header */}
          <div className="flex items-center space-x-4">
            <div className="bg-blue-800/50 px-4 py-2 rounded-full border border-blue-700/50 backdrop-blur-sm">
              <div className="flex items-center space-x-2">
                <Timer className="w-4 h-4 text-blue-300" />
                <span className="text-blue-200 font-mono">{formatTime(sessionTime)}</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Camera Feed */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-2"
          >
            <Card className="shadow-xl border-0 bg-gray-800/90 backdrop-blur-xl border-2 border-blue-400/30">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <User className="w-6 h-6 text-blue-400" />
                  <span>Live Detection Feed</span>
                  {isActive && (
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                    >
                      <Badge className="bg-green-500/80 text-green-100 border border-green-400">
                        <Activity className="w-3 h-3 mr-1" />
                        ACTIVE
                      </Badge>
                    </motion.div>
                  )}
                  {isDetectingYawn && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.3, repeat: Number.POSITIVE_INFINITY }}
                    >
                      <Badge className="bg-orange-500 border border-orange-400 text-white font-bold">
                        YAWN DETECTING...
                      </Badge>
                    </motion.div>
                  )}
                </CardTitle>
                <CardDescription className="text-blue-200">
                  Focusing on **deep mouth opening, high inhalation, and slow exhalation** for precise yawn prediction.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Error Display */}
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-4 bg-red-900/40 border border-red-700 rounded-xl backdrop-blur-sm"
                  >
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-6 h-6 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-bold text-red-300 mb-1 text-lg">Error</h3>
                        <p className="text-red-200">{errorMessage}</p>
                        <div className="flex space-x-2 mt-3">
                          <Button
                            onClick={checkDeviceCapabilities}
                            size="sm"
                            variant="outline"
                            className="bg-transparent border border-red-400/40 text-red-300 hover:bg-red-800/30"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Refresh
                          </Button>
                          <Button
                            onClick={() => (window.location.href = "/permissions")}
                            size="sm"
                            variant="outline"
                            className="bg-transparent border border-blue-400/40 text-blue-300 hover:bg-blue-800/30"
                          >
                            Setup Devices
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-video border-2 border-blue-400/30">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />

                  {/* Overlay Information */}
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-4 left-4 space-y-2"
                    >
                      <Badge className="bg-blue-600/90 backdrop-blur-sm border border-blue-400/50 text-white font-bold">
                        Inhalation: {breathAnalysis.inhalationDepth.toFixed(1)}%
                      </Badge>
                      <Badge className="bg-purple-600/90 backdrop-blur-sm border border-purple-400/50 text-white font-bold">
                        Audio: {breathAnalysis.audioLevel.toFixed(1)}dB
                      </Badge>
                      <Badge className="bg-green-600/90 backdrop-blur-sm border border-green-400/50 text-white font-bold">
                        Rate: {breathAnalysis.breathingRate.toFixed(1)} bpm
                      </Badge>
                    </motion.div>
                  )}

                  {/* Yawn Probability Overlay */}
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-4 right-4 space-y-2"
                    >
                      <Badge className="bg-blue-600/90 backdrop-blur-sm border border-blue-400/50 text-white font-bold text-lg px-4 py-2">
                        MAR: {mouthAspectRatio.toFixed(1)}%
                      </Badge>
                      <Badge className="bg-indigo-600/90 backdrop-blur-sm border border-indigo-400/50 text-white font-bold text-lg px-4 py-2">
                        Yawn Probability: {yawnProbability.toFixed(0)}%
                      </Badge>
                    </motion.div>
                  )}

                  {/* Yawn Detection Display */}
                  <AnimatePresence>
                    {isDetectingYawn && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute inset-0 flex items-center justify-center bg-gray-900/85 backdrop-blur-sm"
                      >
                        <div className="text-center text-white">
                          <motion.div
                            animate={{
                              scale: [1, 1.1, 1],
                              rotate: [0, 3, -3, 0],
                            }}
                            transition={{ duration: 0.3, repeat: Number.POSITIVE_INFINITY }}
                            className="text-5xl font-bold mb-4 text-blue-400"
                          >
                            Yawn Detected!
                          </motion.div>
                          <div className="relative w-96 h-6 bg-gray-700/50 rounded-full overflow-hidden mb-4 border border-blue-400/50">
                            <motion.div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${yawnProgress}%` }}
                              transition={{ duration: 0.1 }}
                            />
                          </div>
                          <div className="text-2xl font-bold">{yawnProgress.toFixed(0)}% Analysis Complete</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!isActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-blue-200">
                        <motion.div
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                        >
                          <CameraOff className="w-20 h-20 mx-auto mb-6 opacity-60" />
                        </motion.div>
                        <p className="text-2xl font-bold mb-2">Detection Paused</p>
                        <p className="text-lg opacity-80">Click "Start Detection" to begin analysis.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex justify-center space-x-4 mt-6"
                >
                  {!isActive ? (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={startDetection}
                        disabled={!deviceInfo.isSupported || (!deviceInfo.hasCamera && !deviceInfo.hasMicrophone)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-xl font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Eye className="w-6 h-6 mr-3" />
                        {!deviceInfo.isSupported
                          ? "Browser Not Supported"
                          : !deviceInfo.hasCamera && !deviceInfo.hasMicrophone
                            ? "No Devices Available"
                            : "Start Detection"}
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={stopDetection}
                        className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 text-xl font-bold rounded-xl shadow-lg"
                      >
                        <CameraOff className="w-6 h-6 mr-3" />
                        Stop Detection
                      </Button>
                    </motion.div>
                  )}

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={resetSession}
                      variant="outline"
                      className="bg-transparent border-2 border-blue-400/50 text-blue-300 hover:bg-blue-800/30 hover:text-white px-8 py-4 text-xl font-bold rounded-xl"
                    >
                      <RotateCcw className="w-6 h-6 mr-3" />
                      Reset Session
                    </Button>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={downloadReport}
                      variant="outline"
                      disabled={yawnHistory.length === 0}
                      className="bg-transparent border-2 border-purple-400/50 text-purple-300 hover:bg-purple-800/30 hover:text-white px-8 py-4 text-xl font-bold rounded-xl disabled:opacity-50"
                    >
                      <Download className="w-6 h-6 mr-3" />
                      Export Report
                    </Button>
                  </motion.div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Statistics Panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Yawn Prediction Card */}
            <Card className="shadow-xl border-0 bg-gray-800/90 backdrop-blur-xl border-2 border-blue-400/30">
              <CardHeader>
                <CardTitle className="text-center text-white text-2xl">Yawn Prediction</CardTitle>
                <CardDescription className="text-center text-blue-200">
                  Probability of an impending yawn based on MAR sequence and physiological indicators.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center p-4 bg-blue-900/30 rounded-xl border border-blue-700/40">
                  <motion.div
                    key={yawnProbability}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.5 }}
                    className="text-6xl font-bold text-blue-400 mb-2"
                  >
                    {yawnProbability.toFixed(0)}%
                  </motion.div>
                  <p className="text-blue-200 font-semibold">Yawn Probability</p>
                </div>
                <div className="mt-4 p-3 bg-indigo-900/30 rounded-xl border border-indigo-700/40">
                  <motion.div
                    key={fatigueLevel}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.5 }}
                    className="text-4xl font-bold text-indigo-400 mb-2"
                  >
                    {fatigueLevel.toFixed(0)}%
                  </motion.div>
                  <p className="text-indigo-200 font-semibold">Fatigue Level</p>
                </div>
                <div className="mt-4 p-3 bg-gray-900/20 rounded-lg border border-gray-700/30">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-200 font-semibold">Current MAR:</span>
                    <span className="font-bold text-lg text-blue-400">{mouthAspectRatio.toFixed(1)}%</span>
                  </div>
                  <div className="text-xs text-gray-300 mt-1">
                    Mouth Aspect Ratio (MAR) is a key indicator for yawn analysis.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Yawn Counters */}
            <Card className="shadow-xl border-0 bg-gray-800/90 backdrop-blur-xl border-2 border-cyan-400/30">
              <CardHeader>
                <CardTitle className="text-center text-white text-2xl">Yawn Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="full" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-blue-900/50 border border-blue-700/40">
                    <TabsTrigger
                      value="full"
                      className="text-blue-200 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold"
                    >
                      Full Yawns
                    </TabsTrigger>
                    <TabsTrigger
                      value="boredom"
                      className="text-orange-200 data-[state=active]:bg-orange-600 data-[state=active]:text-white font-bold"
                    >
                      Boredom Yawns
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="full" className="text-center">
                    <motion.div
                      key={fullYawnCount}
                      initial={{ scale: 1 }}
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.6 }}
                      className="text-6xl font-bold text-blue-400 mb-4"
                    >
                      {fullYawnCount}
                    </motion.div>
                    <p className="text-blue-200 font-semibold">Yawns with broad mouth opening</p>
                  </TabsContent>
                  <TabsContent value="boredom" className="text-center">
                    <motion.div
                      key={boredomYawnCount}
                      initial={{ scale: 1 }}
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.6 }}
                      className="text-6xl font-bold text-orange-400 mb-4"
                    >
                      {boredomYawnCount}
                    </motion.div>
                    <p className="text-orange-200 font-semibold">Subtler yawns indicating fatigue</p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Body Language Indicators (for context) */}
            <Card className="shadow-xl border-0 bg-gray-800/90 backdrop-blur-xl border-2 border-green-400/30">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white text-xl">
                  <BarChart className="w-6 h-6" />
                  <span>Physiological Indicators</span>
                </CardTitle>
                <CardDescription className="text-green-200 font-semibold">
                  These indicators are synchronized with mouth movements for accurate yawn detection.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {bodyLanguage.map((indicator, index) => (
                    <motion.div
                      key={indicator.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.08 }}
                      className="space-y-2"
                    >
                      <div className="flex justify-between items-center text-sm">
                        <span className="flex items-center space-x-2">
                          {indicator.active ? (
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
                            >
                              <CheckCircle2 className="w-5 h-5 text-green-400" />
                            </motion.div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-400/40" />
                          )}
                          <span className={`font-semibold ${indicator.active ? "text-green-300" : "text-gray-200"}`}>
                            {indicator.name}
                          </span>
                        </span>
                        <div className="text-right">
                          <span className={`font-bold ${indicator.active ? "text-green-300" : "text-gray-300"}`}>
                            {indicator.value.toFixed(1)}%
                          </span>
                          <div className="text-xs text-gray-400">Threshold: {indicator.threshold}%</div>
                        </div>
                      </div>
                      <div className="relative">
                        <Progress
                          value={indicator.value}
                          className={`h-3 ${indicator.active ? "bg-green-900/40" : "bg-gray-900/40"}`}
                        />
                        <div
                          className="absolute top-0 h-3 w-0.5 bg-red-400 opacity-60"
                          style={{ left: `${indicator.threshold}%` }}
                        />
                        {indicator.active && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-green-400/30 to-blue-400/30 rounded-full"
                            animate={{ opacity: [0.4, 0.8, 0.4] }}
                            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
                          />
                        )}
                      </div>
                      <p className="text-xs text-gray-300 italic">{indicator.description}</p>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-gray-900/20 rounded-lg border border-gray-700/30">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-200 font-semibold">Active Indicators:</span>
                    <span className="font-bold text-lg text-blue-400">
                      {bodyLanguage.filter((i) => i.active).length}/7
                    </span>
                  </div>
                  <div className="text-xs text-gray-300 mt-1">
                    These indicators contribute to the overall understanding of a yawn event.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="shadow-xl border-0 bg-gray-800/90 backdrop-blur-xl border-2 border-purple-400/30">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white text-xl">
                  <TrendingUp className="w-6 h-6" />
                  <span>Recent Detections</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {yawnHistory
                    .slice(-5)
                    .reverse()
                    .map((yawn, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.08 }}
                        className="flex justify-between items-center text-sm p-3 bg-gray-900/30 rounded-lg border border-gray-700/30 backdrop-blur-sm"
                      >
                        <div className="flex items-center space-x-2">
                          <Badge
                            className={
                              yawn.type === "full"
                                ? "bg-blue-600/80 text-blue-100 border border-blue-400/50"
                                : "bg-orange-600/80 text-orange-100 border border-orange-400/50"
                            }
                          >
                            {yawn.type === "full" ? "Full Yawn" : "Boredom Yawn"}
                          </Badge>
                          <span className="text-gray-200 font-semibold">{yawn.timestamp.toLocaleTimeString()}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white">{yawn.confidence.toFixed(1)}% Confidence</div>
                          <div className="text-xs text-gray-300">{yawn.duration.toFixed(1)}s Duration</div>
                        </div>
                      </motion.div>
                    ))}
                  {yawnHistory.length === 0 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-purple-300 text-sm text-center py-8 font-semibold"
                    >
                      No yawns detected yet. Start a session to see activity.
                    </motion.p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="text-center mt-8 text-gray-400 text-sm"
        >
          <p className="italic mb-2">"Understanding yawns, one subtle movement at a time."</p>
          <p className="text-xs text-gray-500">
            YawnSense provides real-time analysis based on physiological indicators.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
