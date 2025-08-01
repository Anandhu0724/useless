"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ChevronRight, Eye, Clock, TrendingUp } from "lucide-react"

export default function EntryPage() {
  const [animationPhase, setAnimationPhase] = useState(0)
  const [ridePosition, setRidePosition] = useState(0)
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([])

  useEffect(() => {
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
    }))
    setParticles(newParticles)

    const interval = setInterval(() => {
      setAnimationPhase((prev) => (prev + 1) % 4) // Reduced phases for simpler animation
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-gray-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Subtle background particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-1 h-1 bg-blue-300 rounded-full opacity-40"
          style={{ left: `${particle.x}%`, top: `${particle.y}%` }}
          animate={{
            opacity: [0, 0.6, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: 3,
            repeat: Number.POSITIVE_INFINITY,
            delay: particle.delay,
          }}
        />
      ))}

      <div className="max-w-lg w-full text-center space-y-8 relative z-10">
        {/* Animated Mouth Icon */}
        <motion.div
          className="relative mx-auto w-48 h-48 mb-8 flex items-center justify-center"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <motion.div
            className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-30"
            animate={{
              scale: animationPhase === 0 ? 1 : animationPhase === 1 ? 1.2 : animationPhase === 2 ? 1.4 : 1,
            }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute inset-0 bg-blue-700 rounded-full shadow-lg"
            animate={{
              scale: animationPhase === 0 ? 1 : animationPhase === 1 ? 1.1 : animationPhase === 2 ? 1.2 : 1,
            }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-900 rounded-full"
            animate={{
              width:
                animationPhase === 0
                  ? "60px"
                  : animationPhase === 1
                    ? "100px"
                    : animationPhase === 2
                      ? "140px"
                      : "60px",
              height:
                animationPhase === 0 ? "30px" : animationPhase === 1 ? "50px" : animationPhase === 2 ? "70px" : "30px",
            }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-full"
            animate={{
              width:
                animationPhase === 0 ? "50px" : animationPhase === 1 ? "80px" : animationPhase === 2 ? "110px" : "50px",
              height:
                animationPhase === 0 ? "10px" : animationPhase === 1 ? "15px" : animationPhase === 2 ? "20px" : "10px",
              y:
                animationPhase === 0
                  ? "-15px"
                  : animationPhase === 1
                    ? "-25px"
                    : animationPhase === 2
                      ? "-35px"
                      : "-15px",
            }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-400 rounded-full"
            animate={{
              width:
                animationPhase === 0 ? "40px" : animationPhase === 1 ? "70px" : animationPhase === 2 ? "100px" : "40px",
              height:
                animationPhase === 0 ? "20px" : animationPhase === 1 ? "35px" : animationPhase === 2 ? "50px" : "20px",
              y: animationPhase === 0 ? "8px" : animationPhase === 1 ? "15px" : animationPhase === 2 ? "22px" : "8px",
            }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />

          {/* Transition effect */}
          <AnimatePresence>
            {animationPhase === 3 && (
              <motion.div
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 20, opacity: 0 }}
                transition={{ duration: 1, ease: "easeIn" }}
                className="absolute inset-0 bg-gradient-radial from-transparent via-blue-600 to-black rounded-full"
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* App Title */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <h1 className="text-5xl text-white mb-2" style={{ fontFamily: "Times New Roman", fontWeight: "bold" }}>
            YawnSense Pro: The Ultimate Snooze Predictor
          </h1>
          <p className="text-blue-300 text-xl font-light mb-2">വൈനോട്ടൻ ഓൺ വേറെ ലെവൽ</p>
          <p className="text-blue-300 text-xl font-light">We're so good, we'll know you're tired before you do.</p>
        </motion.div>

        {/* Key Features */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="space-y-4 mt-8"
        >
          {[
            { icon: Eye, text: "Real-time Facial Analysis" },
            { icon: TrendingUp, text: "Predictive Yawn Indicators" },
            { icon: Clock, text: "Session Monitoring & Insights" },
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + index * 0.1 }}
              className="flex items-center justify-center space-x-3 p-3 bg-blue-800/30 rounded-lg border border-blue-700/50"
            >
              <feature.icon className="w-6 h-6 text-blue-300" />
              <span className="text-white text-lg">{feature.text}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Start Button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => (window.location.href = "/permissions")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 text-xl font-bold rounded-xl shadow-lg transition-all duration-300"
            >
              <motion.div
                className="flex items-center justify-center"
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
              >
                Start YawnSense
                <ChevronRight className="w-6 h-6 ml-3" />
              </motion.div>
            </Button>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.1 }}
          className="text-gray-400 text-sm mt-8"
        >
          © 2024 YawnSense. All rights reserved.
        </motion.p>
      </div>
    </div>
  )
}
