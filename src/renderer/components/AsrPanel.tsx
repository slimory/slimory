import React, { useState, useRef, useEffect } from 'react'
import './AsrPanel.css'
import microphoneIcon from '../assets/icons/microphone.svg'

interface TranscriptionResult {
    text: string
    segments?: Array<{
        start: number
        end: number
        text: string
    }>
}

const AsrPanel = () => {
    const [isRecording, setIsRecording] = useState(false)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null)
    const [asrReady, setAsrReady] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [recordingMode, setRecordingMode] = useState<'realtime' | 'batch'>('batch')
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const streamRef = useRef<MediaStream | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Initialize ASR service
    useEffect(() => {
        if (!window.electronAPI) return

        const initializeAsr = async () => {
            try {
                const modelCheck = await window.electronAPI.checkModelExists()
                if (!modelCheck.exists) {
                    setError('Model file not found. Please download the Whisper base model to resources/models/ggml-base.bin')
                    return
                }

                const initResult = await window.electronAPI.initializeAsr()
                if (initResult.success) {
                    setAsrReady(true)
                } else {
                    setError(initResult.error || 'Failed to initialize ASR service')
                }
            } catch (error) {
                console.error('[ASR] Initialization error:', error)
                setError(error instanceof Error ? error.message : String(error))
            }
        }

        initializeAsr()

        // Set up transcription result listener
        const handleTranscriptionResult = (_event: any, result: TranscriptionResult) => {
            setTranscriptionResult(result)
            setIsTranscribing(false)
        }

        const handleTranscriptionError = (_event: any, errorMsg: string) => {
            console.error('[ASR] Transcription error:', errorMsg)
            setError(errorMsg)
            setIsTranscribing(false)
        }

        window.electronAPI.onTranscriptionResult(handleTranscriptionResult)
        window.electronAPI.onTranscriptionError(handleTranscriptionError)

        return () => {
            if (isRecording) {
                stopRecording()
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
                streamRef.current = null
            }
        }
    }, [])

    // Start audio recording
    const startRecording = async () => {
        if (!window.electronAPI || !asrReady) {
            setError('ASR service is not ready. Please wait for initialization.')
            return
        }

        try {
            setError(null)
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                } 
            })
            
            streamRef.current = stream

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            })
            
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                    
                    if (recordingMode === 'realtime') {
                        event.data.arrayBuffer().then(buffer => {
                            window.electronAPI?.transcribeAudioBuffer(buffer)
                        })
                    }
                }
            }

            mediaRecorder.onstop = async () => {
                if (recordingMode === 'batch') {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
                    const arrayBuffer = await audioBlob.arrayBuffer()
                    
                    setIsTranscribing(true)
                    await window.electronAPI?.transcribeAudioBuffer(arrayBuffer)
                }

                stream.getTracks().forEach(track => track.stop())
                streamRef.current = null
            }

            mediaRecorder.start(1000)
            setIsRecording(true)
            setTranscriptionResult(null)
        } catch (error) {
            console.error('[ASR] Error starting recording:', error)
            setError('Failed to start recording. Please check microphone permissions.')
        }
    }

    // Stop audio recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
        }
    }

    // Handle microphone button click
    const handleMicrophoneClick = () => {
        if (isRecording) {
            stopRecording()
        } else {
            startRecording()
        }
    }

    // Handle file upload
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file || !window.electronAPI) return

        try {
            setError(null)
            setIsTranscribing(true)
            setTranscriptionResult(null)

            // Read file as ArrayBuffer
            const arrayBuffer = await file.arrayBuffer()
            
            // Transcribe
            await window.electronAPI.transcribeAudioBuffer(arrayBuffer)
        } catch (error) {
            console.error('[ASR] File transcription error:', error)
            setError(error instanceof Error ? error.message : String(error))
            setIsTranscribing(false)
        }
    }

    // Copy transcription to clipboard
    const copyToClipboard = () => {
        if (transcriptionResult?.text) {
            navigator.clipboard.writeText(transcriptionResult.text)
            alert('Transcription copied to clipboard!')
        }
    }

    // Export transcription
    const exportTranscription = () => {
        if (!transcriptionResult?.text) return

        const blob = new Blob([transcriptionResult.text], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `transcription-${Date.now()}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="asr-panel">
            <div className="asr-header">
                <h2>Voice Recognition</h2>
                <div className="asr-status">
                    {asrReady ? (
                        <span className="status-ready">Ready</span>
                    ) : (
                        <span className="status-loading">Initializing...</span>
                    )}
                </div>
            </div>

            {error && (
                <div className="asr-error">
                    {error}
                </div>
            )}

            <div className="asr-controls">
                <div className="recording-mode-selector">
                    <label>
                        <input
                            type="radio"
                            value="batch"
                            checked={recordingMode === 'batch'}
                            onChange={(e) => setRecordingMode(e.target.value as 'batch' | 'realtime')}
                            disabled={isRecording}
                        />
                        Batch Mode
                    </label>
                    <label>
                        <input
                            type="radio"
                            value="realtime"
                            checked={recordingMode === 'realtime'}
                            onChange={(e) => setRecordingMode(e.target.value as 'batch' | 'realtime')}
                            disabled={isRecording}
                        />
                        Realtime Mode
                    </label>
                </div>

                <div className="asr-buttons">
                    <button
                        className={`microphone-btn ${isRecording ? 'recording' : ''}`}
                        onClick={handleMicrophoneClick}
                        disabled={!asrReady || isTranscribing}
                    >
                        <img 
                            src={microphoneIcon} 
                            alt="Microphone" 
                            className={`microphone-icon ${isRecording ? 'recording' : ''}`}
                        />
                        {isRecording ? 'Stop Recording' : 'Start Recording'}
                    </button>

                    <button
                        className="upload-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!asrReady || isRecording || isTranscribing}
                    >
                        Upload Audio File
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                    />
                </div>
            </div>

            {isTranscribing && (
                <div className="transcribing-status">
                    Transcribing audio...
                </div>
            )}

            {transcriptionResult && (
                <div className="transcription-result">
                    <div className="transcription-header">
                        <h3>Transcription Result</h3>
                        <div className="transcription-actions">
                            <button onClick={copyToClipboard}>Copy</button>
                            <button onClick={exportTranscription}>Export</button>
                        </div>
                    </div>
                    <div className="transcription-text">
                        {transcriptionResult.text}
                    </div>
                    {transcriptionResult.segments && transcriptionResult.segments.length > 0 && (
                        <div className="transcription-segments">
                            <h4>Segments:</h4>
                            {transcriptionResult.segments.map((segment, index) => (
                                <div key={index} className="segment">
                                    <span className="segment-time">
                                        {segment.start.toFixed(2)}s - {segment.end.toFixed(2)}s
                                    </span>
                                    <span className="segment-text">{segment.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default AsrPanel

