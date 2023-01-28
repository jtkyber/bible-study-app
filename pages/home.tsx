import { Fragment } from 'react'
import { NextPage } from 'next'
import { useSession, getSession } from 'next-auth/react'
import axios from 'axios'
import { IGroup, IMsg } from '../models/groupModel'
import { useState, useEffect, useRef } from 'react'
import styles from '../styles/Home.module.css'
import { useAppDispatch, useAppSelector } from '../redux/hooks'
import { setSelectedGroup, setSelectedGroupMsgs } from '../redux/groupSlice'
import { useInfiniteQuery } from '@tanstack/react-query'

let scrollElementId: string

const Home: NextPage = ({ userGroups, socket }: { userGroups: IGroup[], socket: any }) => {
  const textAreaRef: React.MutableRefObject<any> = useRef(null)
  const chatAreaRef: React.MutableRefObject<any> = useRef(null)
  const chatBoxRef: React.MutableRefObject<any> = useRef(null)
  const messagesRef: React.MutableRefObject<any> = useRef(null)

  const dispatch = useAppDispatch()

  const selectedGroup: IGroup = useAppSelector(state => state.group.selectedGroup)
  const selectedGroupMsgs: IMsg[] = useAppSelector(state => state.group.selectedGroupMsgs)

  const [inputValue, setInputValue] = useState('')


  const { data: session }: any = useSession()

  useEffect(() => {
    dispatch(setSelectedGroup(userGroups[0]))

    const rooms = userGroups.map(group => {
      return group._id
    })
    socket.emit('join groups', rooms)

    if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight
  }, [])
  
  useEffect(() => {
    socket.on('fetch new group msgs', room => { 
      fetchNewGroupMessages(room)
    })
    return () => {
      socket.off('fetch new group msgs')
    }
  }, [selectedGroupMsgs])
  
  useEffect(() => {
    if (!selectedGroup._id) return
  }, [selectedGroup._id])

  const fetchGroupMessages = async ({ pageParam = 0 }) => {
    if (!selectedGroup._id) return null
    try {
      const res = await axios.get(`/api/getGroupMsgs?groupId=${selectedGroup._id}&cursor=${pageParam}&limit=3`)
      const earliestMsg = document.querySelector(`.${styles.earliestMsg}`)?.id
      if (earliestMsg) scrollElementId = earliestMsg
      return res.data
    } catch (err) {
      console.log(err)
    }
  }
  const { data, status, isFetching, fetchNextPage, hasNextPage, error } = useInfiniteQuery(
    ['groupMessages', selectedGroup._id], fetchGroupMessages, {
      getNextPageParam: (lastPage, pages) => lastPage.cursor
  })

  const fetchNewGroupMessages = async (groupId) => {
    if ((selectedGroup._id !== groupId) || !selectedGroup._id) return
    const res = await axios.get(`/api/getNewGroupMsgs?groupId=${selectedGroup._id}&lastMsgDate=${selectedGroupMsgs[selectedGroupMsgs.length-1].date}`)
    const msgs: IMsg[] = res.data
  }

  useEffect(() => {
    if (!isFetching) {
      document.getElementById(`${scrollElementId}`)?.scrollIntoView()
      chatBoxRef.current.scrollBy(0, -100)
    }
  }, [isFetching])

  const isToday = (someDate) => {
    const today = new Date()
    return someDate.getDate() == today.getDate() &&
      someDate.getMonth() == today.getMonth() &&
      someDate.getFullYear() == today.getFullYear()
  }

  const sendMessage = async () => {
    interface IGroupId {
      groupId: string
    }

    const data: (Partial<IMsg> & IGroupId) = {
      groupId: selectedGroup._id,
      author: session.user.username,
      content: inputValue,
      date: new Date,
      likes: 0,
      psgReference: ''
    }

    const res = await axios.post('/api/postGroupMsg', {
      ...data
    })
    textAreaRef.current.value = ''
    dispatch(setSelectedGroupMsgs([...selectedGroupMsgs, res.data]))

    socket.emit('update group member msgs', selectedGroup._id)
  }

  
  return (
    <div className={styles.container}>
      {
        session ?
        <>
          <div className={styles.userGroups}>
            {
              userGroups.map((group, i) => (
                <div 
                onClick={()=> {dispatch(setSelectedGroup(group))}} 
                key={i} 
                className={`${styles.singleGroup} ${group._id === selectedGroup._id ? styles.selectedGroup : null}`}>
                  <h4 className={styles.groupName}>{group.name}</h4>
                </div>
              ))
            }
          </div>
          <div className={styles.selectedGroup}>
            <h2 className={styles.selectedGroupName}>{selectedGroup?.name}</h2>
            <div ref={chatAreaRef} className={styles.chatArea}>
              <div ref={chatBoxRef} className={styles.chatBox}>
                {hasNextPage 
                  ? <button onClick={() => fetchNextPage()} className={styles.loadMoreMsgsBtn}>Load More</button>
                  : null}
                <div ref={messagesRef} className={styles.messages}>
                  {data?.pages.map((page, i, row1) => (
                      <Fragment key={i}>
                        {page?.data.map((msg, j, row2) => {
                          const dateObj = new Date(msg.date)
                          const date = dateObj.toLocaleDateString()
                          const time = dateObj.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}).replace(/\s+/g, '').toLocaleLowerCase()
                          return (
                            <div key={j} id={msg._id} 
                              className={`
                                ${styles.msg} 
                                ${msg.author === session.user.username ? styles.userMsg : styles.msgFromOther}
                                ${(i+1 === row1.length) && (j+1 === row2.length) ? styles.earliestMsg : null}
                              `}
                            >
                              <h5 className={styles.msgAuthor}>{msg.author}</h5>
                              <h4 className={styles.msgContent}>{msg.content}</h4>
                              <h6 className={styles.msgDate}>{`${isToday(dateObj) ? '' : date + ' '}${time}`}</h6>
                            </div>
                          )
                        })}
                      </Fragment>
                    ))}
                </div>
              </div>

              <div className={styles.chatInputArea}>
                <textarea ref={textAreaRef} onChange={(e) => setInputValue(e.target.value)} rows={4} cols={40} className={styles.input}></textarea>
                <button onClick={sendMessage} className={styles.sendMsgBtn}>Send</button>
                <button onClick={fetchNewGroupMessages}>Update</button>
              </div>
            </div>
          </div>
        </>
        : <h1>Not Authorized</h1>
      }
    </div>
  )
}

export default Home

export async function getServerSideProps({req}) {
  const session: any = await getSession({req})

  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false
      }
    }
  }

  let userGroups: any = []
  
  if (session?.user?.groups) {
    userGroups = await axios.get(`${process.env.CURRENT_BASE_URL}/api/getUserGroups?groupIds=${JSON.stringify(session.user.groups)}`)
  }

  return {
    props: { 
      session,
      userGroups: userGroups.data
    }
  }
}