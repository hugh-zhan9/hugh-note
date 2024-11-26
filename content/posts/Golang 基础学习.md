---
title: "Golang 基础学习"
draft: false
date: 2024-11-25T10:48:25+08:00
description: "记录一下学习Golang基础语法时的笔记"
tags: [Golang]
---



```go
package main

import (
    "database/sql"
    "fmt"
    "io/ioutil"
    "os"
    "path/filepath"
    "strconv"
    "strings"
    "time"

    _ "github.com/go-sql-driver/mysql"
)

// VideoInfo 存储视频的信息
type VideoInfo struct {
    Name    string
    Size    int64
    Width   int
    Height  int
    Bitrate int
    Codec   string
    FPS     float64
    Created time.Time
    Modified time.Time
}

func main() {
    // 替换为您的 MySQL 数据库连接信息
    db, err := sql.Open("mysql", "username:password@tcp(localhost:3306)/dbname")
    if err!= nil {
        fmt.Println("数据库连接错误:", err)
        return
    }
    defer db.Close()

    // 替换为您要扫描的目录
    dir := "/your/directory"
    scanDirectory(dir, db)
}

func scanDirectory(dir string, db *sql.DB) {
    files, err := ioutil.ReadDir(dir)
    if err!= nil {
        fmt.Println("读取目录错误:", err)
        return
    }

    for _, file := range files {
        filePath := filepath.Join(dir, file.Name())
        if file.IsDir() {
            scanDirectory(filePath, db)
            continue
        }

        if isVideoFile(file.Name()) {
            videoInfo, err := getVideoInfo(filePath)
            if err!= nil {
                fmt.Println("获取视频信息错误:", err)
                continue
            }

            insertVideoInfo(videoInfo, db)
        }
    }
}

func isVideoFile(name string) bool {
    extensions := []string{".mp4", ".mkv", ".avi"}
    ext := strings.ToLower(filepath.Ext(name))
    for _, e := range extensions {
        if ext == e {
            return true
        }
    }
    return false
}

func getVideoInfo(filePath string) (VideoInfo, error) {
    fileInfo, err := os.Stat(filePath)
    if err!= nil {
        return VideoInfo{}, err
    }

    // 此处模拟获取视频的其他信息，实际需要使用相应的视频处理库来获取
    return VideoInfo{
        Name:    fileInfo.Name(),
        Size:    fileInfo.Size(),
        Width:   1920,
        Height:  1080,
        Bitrate: 10000,
        Codec:   "H.264",
        FPS:     30.0,
        Created: fileInfo.ModTime(),
        Modified: fileInfo.ModTime(),
    }, nil
}

func insertVideoInfo(videoInfo VideoInfo, db *sql.DB) {
    query := "INSERT INTO videos (name, size, width, height, bitrate, codec, fps, created, modified) VALUES (?,?,?,?,?,?,?,?,?)"
    _, err := db.Exec(query, videoInfo.Name, videoInfo.Size, videoInfo.Width, videoInfo.Height, videoInfo.Bitrate, videoInfo.Codec, videoInfo.FPS, videoInfo.Created, videoInfo.Modified)
    if err!= nil {
        fmt.Println("插入数据库错误:", err)
    }
}
```