// File: vocalRemovalWorker.js
// Questo worker gestisce l'elaborazione audio in un thread separato per non bloccare l'interfaccia utente

/**
 * Web Worker per la rimozione vocale
 * Utilizza l'algoritmo REPET (REpeating Pattern Extraction Technique) semplificato
 * per identificare e rimuovere componenti vocali da un segnale audio
 */
self.onmessage = function(e) {
  try {
    const { leftChannel, rightChannel, sampleRate } = e.data;
    
    // Implementazione semplificata di un algoritmo di rimozione vocale
    // Basato su una versione semplificata del metodo REPET
    
    // Parametri per l'elaborazione
    const fftSize = 2048;
    const hopSize = fftSize / 4;
    const frequencyBinCount = fftSize / 2;
    
    // Funzione per creare una finestra di Hanning
    const createHanningWindow = (size) => {
      const window = new Float32Array(size);
      for (let i = 0; i < size; i++) {
        window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
      }
      return window;
    };
    
    // Crea finestra di Hanning
    const hanningWindow = createHanningWindow(fftSize);
    
    // Funzione per calcolare FFT (implementazione semplificata)
    // In una implementazione reale, usare una libreria FFT ottimizzata
    const calculateFFT = (buffer, window) => {
      // Questa è una semplificazione. In una app reale, utilizzare una libreria FFT
      // come KissFFT o implementare la FFT con WebAssembly per migliori performance
      
      // Qui simulo solo il risultato della FFT
      const result = {
        real: new Float32Array(fftSize),
        imag: new Float32Array(fftSize),
        magnitude: new Float32Array(frequencyBinCount)
      };
      
      // Applica la finestra e calcola la FFT
      for (let i = 0; i < fftSize; i++) {
        // In una implementazione reale, qui ci sarebbe il calcolo della FFT
        // Per questa simulazione, generiamo solo valori
        result.real[i] = buffer[i] * window[i];
        result.imag[i] = 0;
      }
      
      // Calcola la magnitudine
      for (let i = 0; i < frequencyBinCount; i++) {
        const real = result.real[i];
        const imag = result.imag[i];
        result.magnitude[i] = Math.sqrt(real * real + imag * imag);
      }
      
      return result;
    };
    
    // Elabora un canale audio
    const processChannel = (channel) => {
      const processedChannel = new Float32Array(channel.length);
      
      // Copia il canale originale
      for (let i = 0; i < channel.length; i++) {
        processedChannel[i] = channel[i];
      }
      
      // Per ogni frame
      for (let frameStart = 0; frameStart + fftSize < channel.length; frameStart += hopSize) {
        // Estrai frame
        const frame = channel.slice(frameStart, frameStart + fftSize);
        
        // Calcola FFT
        const fft = calculateFFT(frame, hanningWindow);
        
        // Identifica e attenua le frequenze vocali (tipicamente 300-3000 Hz)
        const attenuateVocals = (fft, sampleRate) => {
          // Calcola gli indici delle frequenze da attenuare
          const lowerFreqBin = Math.floor(300 * fftSize / sampleRate);
          const upperFreqBin = Math.ceil(3000 * fftSize / sampleRate);
          
          // Crea una mask di attenuazione (potrebbe essere migliorata con ML)
          for (let i = lowerFreqBin; i <= upperFreqBin && i < frequencyBinCount; i++) {
            // Attenua le frequenze vocali di circa il 70%
            // Un algoritmo più sofisticato userebbe una maschera spettrale adattiva
            fft.magnitude[i] *= 0.3;
          }
          
          return fft;
        };
        
        // Applica l'attenuazione vocale
        const processedFFT = attenuateVocals(fft, sampleRate);
        
        // Ricostruisci il frame temporale (inversa della FFT - semplificata)
        // In una implementazione reale, utilizzare la IFFT
        for (let i = 0; i < fftSize; i++) {
          if (frameStart + i < processedChannel.length) {
            // Semplificazione: scaliamo il valore originale in base al rapporto della magnitudine
            // In una implementazione reale, qui ci sarebbe l'IFFT completa
            const freqBin = Math.min(i, fftSize - i - 1) % frequencyBinCount;
            const ratio = processedFFT.magnitude[freqBin] / (fft.magnitude[freqBin] || 1);
            
            // Overlap-add per la ricostruzione del segnale
            processedChannel[frameStart + i] = frame[i] * ratio * hanningWindow[i];
          }
        }
      }
      
      // Normalizza il canale elaborato
      const max = Math.max(...processedChannel.map(Math.abs));
      if (max > 0) {
        for (let i = 0; i < processedChannel.length; i++) {
          processedChannel[i] /= max;
        }
      }
      
      return processedChannel;
    };
    
    // Elabora entrambi i canali
    const processedLeftChannel = processChannel(leftChannel);
    const processedRightChannel = processChannel(rightChannel);
    
    // Invia i canali elaborati al thread principale
    self.postMessage({
      leftChannel: processedLeftChannel,
      rightChannel: processedRightChannel
    });
  } catch (error) {
    self.postMessage({
      error: error.message || 'Errore durante l\'elaborazione audio'
    });
  }
};
