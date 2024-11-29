---
title: "Golang 基础学习"
draft: false
date: 2024-11-25T10:48:25+08:00
description: "记录一下学习Golang基础语法时的笔记"
tags: [Golang]
---



```go
package main

import "fmt"
import "os"
import "errors"
import "sync"
import "time"


const helloWord string = "Hellow Word!"

func main()  {
	var paramVar = "测试"
	fmt.Println(paramVar)

	test := "测试";
	fmt.Println(helloWord);
	fmt.Println(test);

	x := 1
	p := &x         // 获取 x 的指针
	fmt.Println(p)   
	fmt.Println(*p)
	*p = 2          // *p表达式对应p指针指向的变量的值
	fmt.Println(x);

	// 数组
	nums := []int{10,20,30}

	// 切片
	slice1 := make([]float32, 0)
	slice2 := make([]float32, 3, 5)
	fmt.Println(len(slice1), len(slice2), cap(slice2))

	slice2 = append(slice2, 1,2,3,4)
	fmt.Println(len(slice2), cap(slice2))

	// 子切片 [start:end)
	subSlice1 := slice2[3:]
	subSlice2 := slice2[:3]
	subSlice3 := slice2[1:4]
	fmt.Println(cap(subSlice3), subSlice3)

	// 切片合并
	appendSlice := append(subSlice1, subSlice2...)    // subSlice2... 是切片解构的写法，将切片解构为 N 个独立的元素。
	fmt.Println(appendSlice)


	// map
	map1 := make(map[string]string)
	map2 := map[string]string {
		"key": "value",
	}
	map1["key"] = "value"

	fmt.Println(map1, map2)


	// if-else
	if map1["key"] == "value" {
		fmt.Println("true")
	} else {
		fmt.Println("false")
	}
	// 简写
	if age:=18; age<18 {
		fmt.Println("simple true")
	} else {
		fmt.Println("simple false")
	}

	// switch
	// 在这里，使用了type 关键字定义了一个新的类型 Gender。
	// 使用 const 定义了 MALE 和 FEMALE 2 个常量，Go 语言中没有枚举(enum)的概念，一般可以用常量的方式来模拟枚举。
	type Gender int8
	const(
		MALE Gender = 1
		FEMLE Gender = 2
	)
	gender := MALE

	// 和其他语言不同的地方在于，Go 语言的 switch 不需要 break，匹配到某个 case，执行完该 case 定义的行为后，默认不会继续往下执行。
	switch gender {
	case MALE:
		fmt.Println("MALE")
	case FEMLE:
		fmt.Println("FEMALE")
	default:
		fmt.Println("default")
	}

	// 如果需要继续往下执行，需要使用 fallthrough，
	switch gender {
	case MALE:
		fmt.Println("MALE")
		fallthrough
	case FEMLE:
		fmt.Println("FEMALE")
	default:
		fmt.Println("default")
	}


	// for
	sum:=0
	for i := 0; i < 50; i++ {
		sum++
	}
	fmt.Println(sum)


	//遍历 集合
	for i, num:=range nums {
		fmt.Println(i, num)
	}

	for key, value := range map2 {
		fmt.Println(key, value)
	}

	fmt.Println(add(1,2))

	fmt.Println(div(1,2))

	fmt.Println(addWithReturn(2,4))

	openFile()

	if err := hello("hugh_"); err == nil {
		fmt.Println("err is nil")
	}

	if err := hello(""); err != nil {
		fmt.Println(err)
	}

	res := getByIndexWithOutPanic(5)
	fmt.Println(res)

	// getByIndex(5)

	stu := &Student {
		name: "Tom",
	}
	msg := stu.hello("Jack")
	fmt.Println(msg) // hello Jack, I am Tom


	// 初始化一个对象， 使用接口
	// 实例化 Cat后，强制类型转换为接口类型 Animals
	var ani Animals = &Cat{
		name: "Tom",
		age:  18,
	}
	fmt.Println(ani.getName())

	// 实例可以强制类型转换为接口，接口也可以强制类型转换为实例。
	// 接口转为实例
	cat := ani.(*Cat) 
	fmt.Println(cat.getAge())

	emptyInterface()



	fmt.Println("================================== sync ==================================")


	for i := 0; i < 10; i++ {
		wg.Add(1)
		go syncDownload()
	}
	wg.Wait()
	fmt.Println("sync job done")

	// wg.add(1) 为 wg 添加一个计数， wg.Done() 会减去一个计数
	// go syncDownload() 启动一个协程去并发的执行 syncDownload 函数
	// wg.wait() 等待所有协程执行结束



	for i := 0; i < 3; i++ {
		go channelDownload("download url/" + string(i +'0'))    
		// string(i+'0') 是一种将数值转换成对应 字符串的方式， 是通过 ASCII 码转换的。 
		// 在 golang 中可以使用 str := strconv.Itoa(num) 的方式实现 Java 中 String.valueOf 的效果
		// 对于其他类型的数值，比如 float64 类型，Go 语言使用 strconv.FormatFloat 函数来实现类似的精准转换
		// fmt 的 Sprinf 函数也可以达到相同的效果
	}
	
	for i := 0; i < 3; i++ {
		msg := <- channel
		fmt.Println("finish", msg)
	}
	fmt.Println("channel job done")

}



// 函数  func functionName(param1 type, param2 type, ....) (result1 type, ...) { //body }

func notReturn(num1 int, num2 int) {
	fmt.Println(num1+num2)
}

func noParams() string {
	return "this is retrun"
}

func add(num1 int, num2 int) int {
	return num1 + num2
}

func div(num1 int, num2 int) (int, int) {
	return num1 / num2, num1 % num2
}



// 也可以给返回值命名，简化 return，例如 add 函数可以改写为
func addWithReturn(num1 int, num2 int) (ans int) {
	ans = num1 + num2
	return
}

// 异常处理
func openFile() {
	_, err := os.Open("filename.txt")
	if err != nil {
		fmt.Println(err)
	}
}

// 可以通过 errorw.New 返回自定义的错误
func hello(name string) error {
	if len(name) == 0 {
		return errors.New("error: name is null")
	}
	fmt.Println("Hello,", name)
	return nil
}


// error 往往是能预知的错误，但是也可能出现一些不可预知的错误，例如数组越界，
// 这种错误可能会导致程序非正常退出，在 Go 语言中称之为 panic。
func getByIndex(index int) int {
	array := []int{1,2,3}
	return array[index];
}


// defer-recover 类似 Java 中的 try-catch
// 在函数中，使用 defer 定义了异常处理的函数，在协程退出前，会执行完 defer 挂载的任务。因此如果触发了 panic，控制权就交给了 defer。
// 在 defer 的处理逻辑中，使用 recover，使程序恢复正常，并且将返回值设置为 -1，在这里也可以不处理返回值，如果不处理返回值，返回值将被置为默认值 0
func getByIndexWithOutPanic(index int) (ret int) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("some error happend!", r)
			ret = -1
		}
	}()
	array := []int{1,2,3}
	return array[index];
}


// 结构体 struct 类似于 class
type Student struct {
	name string
	age int
}

// 这是一个方法， 使用 func 直接定义的是函数
func (stu *Student) hello(person string) string {
	fmt.Sprintln("hello %s, I am %s", stu.name, person)
	return fmt.Sprintf("hello %s, I am %s", stu.name, person)

	// f: 支持占位符 ln: 不支持占位符，空格间隔 S：不在终端显示
}

// 使用 Student{field: value, ...}的形式创建 Student 的实例，字段不需要每个都赋值，没有显性赋值的变量将被赋予默认值，
// 例如 age 将被赋予默认值 0。
// 实现方法与实现函数的区别在于，func 和函数名hello 之间，加上该方法对应的实例名 stu 及其类型 *Student，
// 可以通过实例名访问该实例的字段name和其他方法了。调用方法通过 实例名.方法名(参数) 的方式。
// 除此之外，还可以使用 new 实例化：

func newStudent() {
	stu2 := new(Student)
	fmt.Println(stu2.hello("Alice")) // hello Alice, I am  , name 被赋予默认值""
}

// 接口 interface
// golang中并不需要显式地声明实现了哪一个接口，只需要直接实现该接口对应的方法即可。
type Animals interface {
	getName() string
}

type Cat struct {
	name string
	age int
}

func (smallCat *Cat) getName() string {
	return "a small cat, miao miao"
}

func (cat *Cat) getAge() int {
	return cat.age
}

type Dog struct {
	name string
	gender int
}

func (smallDog *Dog) getName() string {
	return "a small dog, wang wang"
}

// 通过下面这种方式可以校验 struct 是否实现了对应接口
type Fish struct {
	name string
	gender int
}

// 就是将 struct 的实例强制转换成 接口的实例，没有实现的接口的话转换就会报错
// 将空值 nil 转换为 *Cat 类型，再转换为 Animals 接口
var _ Animals = (*Cat)(nil)
var _ Animals = (*Dog)(nil)
// var _ Animals = (*Fish)(nil) //cannot use (*Fish)(nil) (value of type *Fish) as Animals value in variable declaration: *Fish does not implement Animals (missing method getName)


// 空接口
// 如果定义了一个没有任何方法的空接口，那么这个接口可以表示任意类型
func emptyInterface() {
	m := make(map[string]interface{})

	m["name"] = "hugh"
	m["age"] = 27
	m["source"] = []int{1,2,3}   // [3]int{1,2,3} 这是一个数组， 而 []int{1,2,3} 是一个切片，数组的长度不能变化，而切片的长度可以变化。

	fmt.Println(m)   
}






/*
 *   golang 中的并发编程
 */

// sync
// golang 中提供了 sync 和 channel 两种方式支持 协程 goroutine 的并发
// 如果类似并发下载，多个并发协程不需要通信，可以使用 sync.WaitGroup 等待所有并发协程执行结束

// 注意这里不是 var wg = sync.WaitGroup
var wg sync.WaitGroup

func syncDownload() {
	fmt.Println("start to sync download something")
	time.Sleep(time.Second)
	wg.Done()
}

// channel
// 使用 channel 信道，可以在协程之间传递消息。阻塞等待并发协程返回消息

var channel = make(chan string, 10)

func channelDownload(url string) {
	fmt.Println("start to channel download something", url)
	time.Sleep(time.Second)
	channel <- url
}




// 单元测试
// 假设我们希望测试 package main 下 calc.go 中的函数，只需要新建一个 calc_test.go 文件
// 在其中新建测试用例即可

// calc.go 文件中
// 
// package main
// 
// func add(num1 int, num2 int) int {
// 	return num1 + num2
// }
//

// calc_test.go
// package main

// import "testing"

// func TestAdd(t *testing.T) {
// 	 if ans := add(1, 2); ans != 3 {
// 		t.Error("add(1, 2) should be equal to 3")
// 	 }
// }

// 运行 go test，将自动运行当前 package 下的所有测试用例，如果需要查看详细的信息，可以添加-v参数。  go test -v




// golang 中的 包Package 和 模块Modules
// 一般来说，一个文件夹可以作为 package，同一个 package 内部变量、类型、方法等定义可以相互看到
// 加入在一个文件夹中我们写了一个 calc.go 和 main.go， calc.go 定义了一个 add 函数, 在 main.go 中进行了调用，此时就需要 go run . 或者  go run main.go calc.go 来编译

// golang 也有 Public 和 Private 的概念，粒度是包。
// 如果类型/接口/方法/函数/字段的首字母大写，则是 Public 的，对其他 package 可见，如果首字母小写，则是 Private 的，对其他 package 不可见


// Modules 是 golang 1.11 之后引入的，之前使用 $GOPATH 机制，Go Modules 可以算作是较为完善的包管理工具。同时支持代理，国内也能享受高速的第三方包镜像服务。
// Go Modules 在 1.13 版本仍是可选使用的，环境变量 GO111MODULE 的值默认为 AUTO，强制使用 Go Modules 进行依赖管理，可以将 GO111MODULE 设置为 ON。

// 在一个空文件夹下，初始化一个 Module
// 
// $ go mod init example
// go: creating new go.mod: module example

// 此时，在当前文件夹下生成了go.mod，这个文件记录当前模块的模块名以及所有依赖包的版本。
// 接着，我们在当前目录下新建文件 main.go，添加如下代码：

// package main

// import (
// 	"fmt"

// 	"rsc.io/quote"
// )

// func main() {
// 	fmt.Println(quote.Hello())  // Ahoy, world!
// }

// 运行 go run .，就会触发第三方包 rsc.io/quoto 的下载，具体的版本信息也会记录在 go.mod 中

// module example
// go 1.13
// require rsc.io/quote v3.1.0+incompatible


// 我们在当前目录，添加一个子 package calc，代码目录如下：
//
// demo/
//    |--calc/
//       |--calc.go
//    |--main.go
//
// 在 calc.go 中写入

// package calc

// func Add(num1 int, num2 int) int {
// 	return num1 + num2
// }

// 在 package main 中如何使用 package cal 中的 Add 函数呢？import 模块名/子目录名 即可，修改后的 main 函数如下：

// package main
// 
// import (
// 	"fmt"
// 	"example/calc"
// 
// 	"rsc.io/quote"
// )
// 
// func main() {
// 	fmt.Println(quote.Hello())
// 	fmt.Println(calc.Add(10, 3))
// }


// Go Modules 就类似于 Java 中的 Maven，做一个项目中的包管理
```