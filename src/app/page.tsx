"use client";
import PCMPlayer from "pcm-player";
import { useEffect, useRef, useState } from "react";

const WebSocketComponent = () => {
  const AGENT_ID = "AAAAa-Y0fgwrqhl3OJbuE2OQS9v";
  const API_KEY = "ak-b4055d6cc2114a89adc630c788309f64";
  let concatenatedArray = new Uint8Array([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isConversation, setIsConversation] = useState(false);

  useEffect(() => {
    if (isConversation == true) {
      const socket = new WebSocket(`wss://api.play.ai/v1/talk/${AGENT_ID}`);
      //const socket = new WebSocket(`ws://localhost:8000/ws/${AGENT_ID}`);
      socket.binaryType = "arraybuffer"; // Set binary type to arraybuffer
      const player = new PCMPlayer({
        inputCodec: "Int16",
        channels: 1,
        sampleRate: 44100,
        flushTime: 100,
        fftSize: 2048,
      });

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            type: "setup",
            apiKey: API_KEY,
            outputFormat: "wav",
            outputSampleRate: 44100,
            inputEncoding: "wav",
            inputSampleRate: 44100,
          })
        );
        console.log("WebSocket connection established");
        startRecording(socket);
      };

      socket.onmessage = async (message) => {
        const event = JSON.parse(message.data);
        console.log(event);
        if (event.type === "audioStream") {
          try {
            const binaryString = atob(event.data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            concatenatedArray = concatenateUint8Arrays([
              concatenatedArray,
              bytes,
            ]);
            player.feed(bytes.buffer);
            player.volume(1.0);
          } catch (error) {
            console.error("Error playing audio:", error);
          }
        }
      };

      socket.onclose = () => {
        console.log("WebSocket connection closed");
        saveUint8ArrayToFile(concatenatedArray, "combined_file.bin");
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      return () => {
        socket.close();
      };
    }
  }, [isConversation]);
  const startRecording = async (socket: WebSocket) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        autoGainControl: true,
        noiseSuppression: true,
      },
    });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
      const base64Data = await blobToBase64(event.data);
      if (socket.readyState === WebSocket.OPEN) {
        console.log(event);
        socket.send(
          JSON.stringify({
            type: "audioIn",
            data: base64Data,
          })
        );
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });
      const url = URL.createObjectURL(audioBlob);

      // Create a link to download the audio file
      const link = document.createElement("a");
      link.href = url;
      link.download = "recording.webm"; // Set the desired file name
      document.body.appendChild(link);
      link.click(); // Trigger the download
      document.body.removeChild(link); // Clean up
      URL.revokeObjectURL(url); // Release the object URL

      audioChunksRef.current = []; // Clear the chunks for the next recording
    };

    mediaRecorder.start(1500);
  };

  const blobToBase64 = (blob) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    return new Promise((resolve) => {
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
    });
  };

  const concatenateUint8Arrays = (arrays) => {
    // Calculate total length of the concatenated array
    let totalLength = arrays.reduce((acc, value) => acc + value.length, 0);
    // Create a new Uint8Array to hold all the data
    let result = new Uint8Array(totalLength);
    // Append each array into the result array
    let offset = 0;
    arrays.forEach((arr) => {
      result.set(arr, offset);
      offset += arr.length;
    });
    return result;
  };

  const saveUint8ArrayToFile = (uint8Array, fileName) => {
    // Create a blob from the concatenated Uint8Array
    const blob = new Blob([uint8Array], { type: "application/octet-stream" });
    // Create a link element
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    // Set the href and download attributes
    link.href = url;
    link.download = fileName;
    // Append to the DOM and trigger download
    document.body.appendChild(link);
    link.click();
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const startConversation = () => {
    setIsConversation(!isConversation);
  };

  return (
    <div className="flex justify-center items-center gap-4 p-8 w-full h-screen">
      {isConversation ? (
        <button
          className="bg-red-800 hover:bg-red-600 px-4 py-2 rounded-md text-white"
          onClick={startConversation}
        >
          Stop Conversation
        </button>
      ) : (
        <button
          className="bg-blue-800 hover:bg-blue-600 px-4 py-2 rounded-md text-white"
          onClick={startConversation}
        >
          Start Conversation
        </button>
      )}
    </div>
  );
};

export default WebSocketComponent;
