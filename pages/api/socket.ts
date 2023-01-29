import { Server } from 'socket.io'

const SocketHandler = (req, res) => {
    if (res.socket.server.io) {
        console.log('Socket is already running')
    } else {
        console.log('Socket is initializing')
        const io = new Server(res.socket.server)
        res.socket.server.io = io

        io.on('connection', (socket) => {
            socket.on('join groups', rooms => {
                for (let i=0; i<rooms.length; i++) {
                    socket.join(rooms[i])
                }
            })

            socket.on('update group member msgs', data => {
                socket.to(data.room).emit('fetch new group msgs', {groupId: data.room, msg: data.msg})
            })
        })
    }
    res.end()
}

export default SocketHandler