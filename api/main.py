from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import websockets
import asyncio

app = FastAPI()

@app.websocket("/ws/{agent_id}")
async def websocket_endpoint(websocket: WebSocket, agent_id: str):
    await websocket.accept()
    uri = f"wss://api.play.ai/v1/talk/{agent_id}"
    print(uri)
    
    while True:
        try:
            async with websockets.connect(uri) as play_ai_socket:
                print("Connected to play.ai")
                while True:
                    try:
                        data = await websocket.receive_text()
                        await play_ai_socket.send(data)

                        while True:
                            try:
                                response = await asyncio.wait_for(play_ai_socket.recv(), timeout=1)
                                await websocket.send_text(response)
                            except asyncio.TimeoutError:
                                print("No response from AI")
                                break

                    except WebSocketDisconnect:
                        print(f"WebSocket connection closed by client with agent_id: {agent_id}")
                        return
                    except Exception as e:
                        print(f"An error occurred while processing: {e}")
                        break
        except websockets.ConnectionClosedError as e:
            print(f"Connection to play.ai lost: {e}. Retrying...")
            await asyncio.sleep(5)  # Wait before retrying
        except Exception as e:
            print(f"Failed to connect to play.ai: {e}")
            await asyncio.sleep(5)  # Wait before retrying