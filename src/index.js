import React, { useEffect, useState, useRef } from "react"

import { Image } from "react-native"
import * as FileSystem from "expo-file-system"

import PropTypes from "prop-types"

import * as CONST from "./consts.js"

const CachedImage = (props) => {
  console.log("-----props----",props)
  const { source, cacheKey, placeholderContent } = props
  const { uri, headers, expiresIn } = source
  const fileURI = `${CONST.IMAGE_CACHE_FOLDER}${cacheKey}`

  const [imgUri, setImgUri] = useState(fileURI)
  const [cachedImgUri, setCachedImgUri] = useState(undefined);

  const componentIsMounted = useRef(true)
  const requestOption = headers ? { headers } : {}
  const downloadResumableRef = useRef(
    FileSystem.createDownloadResumable(uri, fileURI, requestOption, _callback),
  )

  useEffect(() => {
    loadImage()
    return () => {
      componentIsMounted.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadImage = async () => {
    try {
      // Use the cached image if it exists
      const metadata = await FileSystem.getInfoAsync(fileURI)
      const expired =
        expiresIn &&
        new Date().getTime() / 1000 - metadata?.modificationTime > expiresIn
      // console.log({expiresIn, expired})

      // console.log({modificationTime: metadata.modificationTime, currentTime: new Date().getTime() / 1000})
      // console.log({metadata})
      if (!metadata.exists || metadata?.size === 0 || expired) {
        if (componentIsMounted.current) {
          setCachedImgUri(undefined)

          if (expired) {
            await FileSystem.deleteAsync(fileURI, { idempotent: true })
          }
          // download to cache
          setCachedImgUri(undefined)

          const response = await downloadResumableRef.current.downloadAsync()
          if (componentIsMounted.current && response.status === 200) {
            setCachedImgUri(`${fileURI}?`) // deep clone to force re-render
          }
          if (response.status !== 200) {
            FileSystem.deleteAsync(fileURI, { idempotent: true }) // delete file locally if it was not downloaded properly
          }
        }
      } else {
        setCachedImgUri(imgUri)
      }
    } catch (err) {
      // console.log({ err })
    }
  }

  const _callback = (downloadProgress) => {
    if (componentIsMounted.current === false) {
      downloadResumableRef.current.pauseAsync()
      FileSystem.deleteAsync(fileURI, { idempotent: true }) // delete file locally if it was not downloaded properly
    }
  }
  // console.log({placeholderContent})
  if (!cachedImgUri) return placeholderContent || null

  return (
    <Image
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
      source={{
        ...source,
        uri: cachedImgUri,
      }}
    />
  )
}

CachedImage.propTypes = {
  source: PropTypes.object.isRequired,
  cacheKey: PropTypes.string.isRequired,
}

export const CacheManager = {
  addToCache: async ({ file, key }) => {
    await FileSystem.copyAsync({
      from: file,
      to: `${CONST.IMAGE_CACHE_FOLDER}${key}`,
    })
    // const uri = await FileSystem.getContentUriAsync(`${CONST.IMAGE_CACHE_FOLDER}${key}`)
    // return uri
    const uri = await CacheManager.getCachedUri({ key })
    return uri
  },

  getCachedUri: async ({ key }) => {
    const uri = await FileSystem.getContentUriAsync(
      `${CONST.IMAGE_CACHE_FOLDER}${key}`,
    )
    return uri
  },

  downloadAsync: async ({ uri, key, options }) => {
    return await FileSystem.downloadAsync(
      uri,
      `${CONST.IMAGE_CACHE_FOLDER}${key}`,
      options,
    )
  },
}

export default CachedImage
