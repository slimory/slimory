// AudioWorklet processor for capturing audio data
class AudioProcessorWorklet extends AudioWorkletProcessor {
    constructor() {
        super()
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]
        
        // Check if we have input data
        if (input && input.length > 0) {
            let audioData
            
            // Handle multiple channels (stereo to mono conversion)
            if (input.length === 1) {
                // Mono input
                audioData = new Float32Array(input[0])
            } else {
                // Stereo or more channels - mix down to mono
                const numSamples = input[0].length
                audioData = new Float32Array(numSamples)
                
                for (let i = 0; i < numSamples; i++) {
                    let sum = 0
                    // Average all channels
                    for (let channel = 0; channel < input.length; channel++) {
                        sum += input[channel][i]
                    }
                    audioData[i] = sum / input.length
                }
            }
            
            // Send audio data to main thread
            this.port.postMessage({
                type: 'audioData',
                audioData: audioData
            })
        }
        
        // Keep processor alive
        return true
    }
}

registerProcessor('audio-processor', AudioProcessorWorklet)
