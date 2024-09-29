import "./style.css";
import { interval, fromEvent, zip, of, merge, scheduled, Observable} from "rxjs";
import { map, filter, take, first, scan, mergeAll} from 'rxjs/operators'
import { LoaderOptionsPlugin } from "webpack";

const svg = document.querySelector("#backgroundLayer")! as SVGElement & HTMLElement
const svgFront = document.querySelector("#foregroundLayer")! as SVGElement & HTMLElement


function main() {
  /**
   * Inside this function you will use the classes and functions from rx.js
   * to add visuals to the svg element in pong.html, animate them, and make them interactive.
   *
   * Study and complete the tasks in observable examples first to get ideas.
   *
   * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
   *
   * You will be marked on your functional programming style
   * as well as the functionality that you implement.
   *
   * Document your code!
   */

  /**
   * This is the view for your game to add and update your game elements.
   */

  
  // Type annotation for the keypresses, event and viewtypes (or object)
  type Key = 'w' | 'a' | 's' | 'd' | 'r'
  type Event = 'keydown'
  type ViewType = 'frog' | 'car' | 'plank'

  // Type annotation for the circle object, 
  // It is "Readonly" to ensure that the type is immutable
  type BodyCircle = Readonly <{ r : number, cx : number, cy : number, style : string, id : string }>
  type BodyRect = Readonly <{ width : number, height :number, x : number, y : number, style : string, id : string, direction : number, speed : number }>
  type Timer = Readonly <{ x : number, y : number, direction : -1 | 1, timer : Observable<number> , speed : number}>
  type Row = Readonly<{ row1 : Timer, row2 : Timer, row3 : Timer, row4 : Timer, row5 : Timer, row6 : Timer, row7 : Timer, row8 : Timer, row9 : Timer, row10 : Timer }>
  type State = Readonly <{ time : number, frog : BodyCircle, car : ReadonlyArray<BodyRect>, plank : ReadonlyArray<BodyRect>, 
    objCount : number, gameOver : boolean, score : number , score_temp : number, land : boolean, restart : boolean, high_score : number}>
  

  // Moving object state
  class Tick { constructor(public readonly elapsed : number) {}}
  class MoveX { constructor(public readonly transform : number)  {}}
  class MoveY { constructor(public readonly transform : number) {}}
  class LoopCar { constructor(public readonly  x : number, public readonly y : number, public readonly  direction : number, public readonly speed : number) {}}
  class LoopPlank { constructor(public readonly  x : number, public readonly y : number, public readonly  direction : number, public readonly speed : number) {}}
  class Restart { constructor() {}}

  // Game timer
  const gameClock = interval(10).pipe(map(elapsed => new Tick(elapsed)))

  
  /**
   * A key observable that check if the pressed key is equal to the given "k" key 
   * and filter repeating key input (Hold keypresses)
   * 
   * @param e The event occurs (Ex. Keyboard input, mouse input)
   * @param k The input key
   * @param result No argument function, return the KeyboardEvent
   */ 
  const keyObservable = <T>(e : Event, k : Key, result : () => T) =>
    fromEvent<KeyboardEvent>(document, e)
      .pipe(
        filter(({key}) => key == k),
        filter(({repeat}) => !repeat),
        map(result))
  
  /**
   * Variables containing the observables, an instance of movement will be created when 
   * specific input is detected from the observable.
   * 
   * Key inputs : 'w' => up, 's' => down , 'a' => left, 'd' => righ
   */
  const startUp = keyObservable('keydown', 'w', ()=> new MoveY(-60))
  const startDown = keyObservable('keydown', 's', ()=> new MoveY(60))
  const startLeft = keyObservable('keydown', 'a', ()=> new MoveX(-60))
  const startRight = keyObservable('keydown', 'd', ()=> new MoveX(60))
  const restart = keyObservable('keydown', 'r', () => new Restart())
  
     /**
      * Create a rectangle object
      * 
      * @param viewType 
      * @returns 
      */
     const createRectangle = (viewType : ViewType) => (w : number) => (h : number) => 
     (coordX : number) => (coordY : number) => (style : string) => (id : number) => (direction : number) => (speed : number) =>
     <BodyRect> {
       width : w,  
       height :h,     
       x : coordX,       
       y : coordY,
       style : style, 
       id : viewType + id,
       direction : direction,
       speed : speed
     }
   
     /**
      * Create a frog object with a Circle body,
      * @returns the attribute of the frog, with type BodyCircle
      */
     const createFrog = () : BodyCircle => {
       return {
         r : 20, 
         cx : 30, 
         cy : 770, 
         style: "fill: green; stroke: white; stroke-width: 1px;",
         id : "frog"
       }
     }

     const move = (b : BodyRect) => 
     b.direction == 1 ?
     {...b,
       x :  b.x + b.speed
     } : {...b,
      x :  b.x - b.speed
    }

   
    const handleCollisions = (s : State) => {

      const targetArea = [40, 210, 380, 550, 720]     
       
      const carCollided = ([a,b]:[BodyCircle, BodyRect]) => (a.cy - 20) == (b.y) && 
      (
        ((a.cx - 20) <= (b.x + 40) && (a.cx - 20) >= (b.x)) ||
        ((a.cx + 20) >= (b.x) && (a.cx + 20) <= (b.x + 40))
      )
     const inPlank = ([a, b] : [BodyCircle, BodyRect]) => ((a.cy <= 390 && a.cy >= 90) && ((a.cx + 20 > b.x) && (a.cx - 20 <= b.x + 150)) && (a.cy - 20 == b.y))

      const checkTarget = (acc : number, c : number) : number => {
        return ((s.frog.cy == 50) && (s.frog.cx - 20 >= c - 5) && (s.frog.cx + 20 <= c  + 60 + 5)) ? acc + 1 : acc + 0
      }
      
      // Check if frog collided with car or frog drop into the river
      const frogCollidedCar = s.car.filter(r => carCollided([s.frog,r])).length > 0
      const frogNotInPlank = !(s.plank.filter(r => inPlank([s.frog, r])).length > 0) && !(s.frog.cy - 20 >= 390 || s.frog.cy <= 90)
      
      // If frog on top of the plank, frog move with the plank
      const moveValue = s.plank.filter(r => inPlank([s.frog, r])).map(obj => obj.direction * obj.speed)
      const frogMoveWithPlank = moveValue[0] === undefined ? 0 : moveValue[0]
      
      // Frog landed at target area and score, if not frog will die
      const atTargetArea = targetArea.reduce(checkTarget, 0) > 0
      const notAtTargetArea = (s.frog.cy == 50) && !atTargetArea
      const extraScore = atTargetArea ? 100 : 0

      return <State> { 
        time : s.time, 
        frog : {...s.frog, 
        cx : s.frog.cx + frogMoveWithPlank
        },
        car : s.car,
        plank : s.plank,
        objCount : s.objCount,
        gameOver : frogCollidedCar || frogNotInPlank  || notAtTargetArea,
        score : s.score + extraScore,
        score_temp : s.score_temp + extraScore,
        land : atTargetArea,
        restart : false,
        high_score :s.high_score + extraScore
      }
  
    }
  
     const tick = (s : State, elapsed : number) => {

      const changeScore = s.score_temp > s.score ? s.score_temp : s.score
   
       return handleCollisions({...s, 
        time : elapsed, 
        frog : s.frog, 
        car : s.car.map(move),
        plank : s.plank.map(move),
        objCount : s.car.length + s.plank.length,
        gameOver : false,
        score : changeScore,
        land : s.land, 
        restart : false,
        high_score : s.high_score > s.score ? s.high_score : s.score
       })
     }
   
     
     /**
      * Reduce state is a function that checks the instance of the object state and modify
      * the state based on the instance value. Later return the modified state. It can be
      * act as a reduce function which the State as the accumulator and object state as
      * current value
      * 
      * @param s The game state
      * @param e The object state such as movements
      * @returns The modified game state
      */
     const reduceState = (s : State, e : MoveX | MoveY | Tick | LoopCar | LoopPlank | Restart) =>
       e instanceof MoveX ? 
         ((s.frog.cx + e.transform >= 10 && s.frog.cx + e.transform <= 840)
           ? {...s, frog : {...s.frog, cx : s.frog.cx + e.transform}} : 
           {...s, frog : {...s.frog, cx : s.frog.cx}}) :
       e instanceof MoveY ?
         ((s.frog.cy + e.transform >= 10 && s.frog.cy + e.transform <= 800) 
           ? (e.transform < 0 ? 
            {...s, 
              frog : {...s.frog, cy : s.frog.cy + e.transform},
              score_temp : s.score_temp + 10,
            } : 
            {...s, 
              frog : {...s.frog, cy : s.frog.cy + e.transform},
              score_temp : s.score_temp - 10,
            }
          ): 
           {...s, frog : {...s.frog, cy : s.frog.cy}}) :

       e instanceof LoopCar ? {...s,
         car : s.car.concat([createRectangle("car")(40)(40)(e.x)(e.y)("fill: red; stroke: red; stroke-width: 1px;")(s.objCount)(e.direction)(e.speed)]),
         objCount : s.objCount + 1
       } : 
        e instanceof LoopPlank ? {...s,
          plank : s.plank.concat([createRectangle("plank")(150)(40)(e.x)(e.y)("fill: #c35b45; stroke: #c35b45; stroke-width: 1px;")(s.objCount)(e.direction)(e.speed)]),
          objCount : s.objCount + 1
        } :
        e instanceof Restart ? {...s,
          time : 0, 
          frog : createFrog(), 
          car : [],
          plank : [], 
          objCount : 0,
          gameOver : false,
          score : 0,
          score_temp : 0, 
          land : false,
          restart : true, 
          high_score : s.high_score > s.score ? s.high_score : s.score
      }
        :
          tick(s, e.elapsed)
     
     /**
      * Update the view of the game, specifically the view of the HTML
      * @param s 
      */
     const updateView = (s : State) => {
     
       const updateFrog = (f : BodyCircle) => {
        const createView = () => {
          const frog = document.createElementNS(svg.namespaceURI, "circle");
          Object.entries(createFrog()).forEach(([key, val]) => frog.setAttribute(key, String(val)))
          frog.classList.add("object")
          svgFront.appendChild(frog)
          return frog;
        }
        const frogID = document.getElementById(f.id)
        frogID == null ? createView() : attr(frogID, s.frog)
       }
       const updateView = (b : BodyRect) => {
   
         const createView = () => {
           const objShow = document.createElementNS(svg.namespaceURI, "rect")!
           attr(objShow ,{width : b.width, height : b.height, x : b.x, y : b.y, style : b.style, id : b.id});
             objShow.classList.add("object")
             svg.appendChild(objShow)
             return objShow;
         }
         const car = document.getElementById(b.id)
         car == null ? createView() : attr(car, {width : b.width, height : b.height, x : b.x, y : b.y, style : b.style, id : b.id})
       }
       
       const updateText = (s : State) => {
        const createView = (x : number, y : number, id : String) => {
          const score = document.createElementNS(svg.namespaceURI, "text");
          attr(score, {x: x ,y: y, class:"score", font : "100px", id: id })
          score.classList.add("object")
          svgFront.appendChild(score)
        }
        const v = document.getElementById("score")
        const w = document.getElementById("highscore")
        v == null ? createView(100, 410, "score") : v.textContent = `Score: ${s.score} `
        w == null ? createView(100, 430, "highscore") : w.textContent = `High Score: ${s.high_score} `
       }
       
       updateFrog(s.frog)
       s.car.forEach(updateView)
       s.plank.forEach(updateView)
       updateText(s)

       if(s.gameOver) {
        subscription.unsubscribe();
        const v = document.createElementNS(svg.namespaceURI, "text")!;
        attr(v,{x: 350 ,y: 410, class:"gameover", font : "100px"});
        v.textContent = "GAME OVER!";
        svg.appendChild(v);
      }

      if(s.land) {
        subscription.unsubscribe();
        const v = document.createElementNS(svg.namespaceURI, "text")!;
        attr(v,{x: 350 ,y: 410, class:"land", font : "100px"});
        v.textContent = "YOU WIN!";
        svg.appendChild(v);
      }

      if(s.restart) {
        const elements = document.querySelectorAll('.object')
        elements.forEach(element => element.remove())
        
      }


     }
   

  /**
   * The initial state of the game, it is created based on State type.
   */
   const initialState : State = { 
    time : 0, 
    frog : createFrog(), 
    car : [],
    plank : [], 
    objCount : 0,
    gameOver : false,
    score : 0,
    score_temp : 0, 
    land : false,
    restart : false, 
    high_score : 0
  }

  const row : Row = {
    row1 : {x : 840, y : 690, timer : interval(10000), direction : -1, speed : 0.7}, 
    row2 : {x : 0, y : 630, timer : interval(9000), direction : 1, speed : 1}, 
    row3 : {x : 840, y : 570, timer : interval(9000), direction : -1, speed : 1}, 
    row4 : {x : 0, y : 510, timer : interval(8000), direction : 1, speed : 0.7}, 
    row5 : {x : 840, y : 450, timer : interval(8000), direction : -1, speed : 0.7}, 
    row6 : {x : 840, y : 330, timer : interval(10000), direction : -1, speed : 0.7}, 
    row7 : {x : 0, y : 270, timer : interval(9000), direction : 1, speed : 0.7}, 
    row8 : {x : 0, y : 210, timer : interval(9000), direction : 1, speed : 0.6}, 
    row9 : {x : 840, y : 150, timer : interval(8000), direction : -1, speed : 0.6}, 
    row10 : {x : 0, y : 90, timer : interval(8000), direction : 1, speed : 0.5}, 
  }



 



  // Append the frog object into the HTML


  
  /**
   * Merge the observables. When there is a stream it will modify the state based on the stream from the scan function
   * and return a modified state which later parse into the updateView function initial state will be the initial value
   * for the scan (or the starting of the game)
   */ 

  const road = merge(
    row.row1.timer.pipe(map(_ => new LoopCar(row.row1.x, row.row1.y, row.row1.direction, row.row1.speed))), 
    row.row2.timer.pipe(map(_ => new LoopCar(row.row2.x, row.row2.y, row.row2.direction, row.row2.speed))),
    row.row3.timer.pipe(map(_ => new LoopCar(row.row3.x, row.row3.y, row.row3.direction, row.row3.speed))),
    row.row4.timer.pipe(map(_ => new LoopCar(row.row4.x, row.row4.y, row.row4.direction, row.row4.speed))),
    row.row5.timer.pipe(map(_ => new LoopCar(row.row5.x, row.row5.y, row.row5.direction, row.row5.speed))),
  )

  const river = merge(
    row.row6.timer.pipe(map(_ => new LoopPlank(row.row6.x, row.row6.y, row.row6.direction, row.row6.speed))), 
    row.row7.timer.pipe(map(_ => new LoopPlank(row.row7.x, row.row7.y, row.row7.direction, row.row7.speed))),
    row.row8.timer.pipe(map(_ => new LoopPlank(row.row8.x, row.row8.y, row.row8.direction, row.row8.speed))),
    row.row9.timer.pipe(map(_ => new LoopPlank(row.row9.x, row.row9.y, row.row9.direction, row.row9.speed))),
    row.row10.timer.pipe(map(_ => new LoopPlank(row.row10.x, row.row10.y, row.row10.direction, row.row10.speed))),
  )
  

  const input = merge(
    startDown, startUp, startLeft, startRight, restart
  )

  const obs = merge(
    gameClock,
    input, 
    road, 
    river
  )

  const subscription = obs.pipe(
      scan(reduceState, initialState))
    .subscribe(updateView)

 

 




  }
  

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main(); 
  };
}

const
/**
 * set a number of attributes on an Element at once
 * @param e the Element
 * @param o a property bag
 */         
 attr = (e:Element,o:Object) =>
 {Object.entries(o).forEach(([key, val]) => e.setAttribute(key, String(val)))}

