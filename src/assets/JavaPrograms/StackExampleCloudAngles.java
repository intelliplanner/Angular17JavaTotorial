/**
 * Program: Stack Example 
 */
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Stack;

public class StackExampleCloudAngles {

	public static void main(String[] args) {
//		System.out.println(check("([])"));    //true
//        System.out.println(check("()[]"));    //true
//        System.out.println(check("([)]"));    //false
//        System.out.println(check("(("));      //false
//        System.out.println(check("[(()])"));   //false
//        System.out.println(check("([(([]))][]())"));   //true
		
		
		
//		System.out.println(check("[][][][]"));    //true      LIFO
//        System.out.println(check("[[[]]][][]"));    //true
//        System.out.println(check("]]][[["));    //false
//        System.out.println(check("[][][[]"));      //false
//        System.out.println(check("[][]][[]"));   //false
//        System.out.println(check("[[[]]]"));   //true
        
        checkByQueue(new String());
        System.out.println(checkByQueue("[][][][]"));    //true    FIFO
        System.out.println(checkByQueue("[[[]]][][]"));    //true
        System.out.println(checkByQueue("]]][[["));    //false
        System.out.println(checkByQueue("[][][[]"));      //false
        System.out.println(checkByQueue("[][]][[]"));   //false
        System.out.println(checkByQueue("[[[]]]"));   //true
         	
        
	}
	
	public static boolean checkByQueue(String str) {
	    if (null == str || str.isEmpty()) {
	        return true;
	    }
	    // System.out.print(str + " -> ");
	    Deque<Character> stack = new ArrayDeque<>();
	    
	    for (char c : str.toCharArray()) {
	        if (c == ']' || c == ')') {
	            if (stack.isEmpty()) {
	                return false;
	            }
	            char prev = stack.pop();
	            if (prev != '[' && c == ']' || prev != '(' && c == ')') {
	                return false;
	            }
	        } else if (c == '[' || c == '(') {
	            stack.push(c);
	        } else {
	            return false;
	        }
	    }
	    return stack.isEmpty();
	}

	public static boolean check(String v) {
	        if (v == null || v.isEmpty()) return true;
	        Stack<Character> stack = new Stack<>();
	        for (int i = 0; i < v.length(); ++i) {
	            char c = v.charAt(i);
	            if (c == '(' || c == '[') {
	                stack.push(c);
	            } else if (stack.isEmpty()) {
	                return false;
	            } else if ((stack.peek() == '(' && c == ')') || (stack.peek() == '[' && c == ']')) {
	                stack.pop();
	            } else {
	                return false;
	            }
	        }
	        return stack.isEmpty();
	    }

}
