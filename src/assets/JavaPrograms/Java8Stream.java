/**
 * Program: Java8Stream
 */
/**
 * Program: Java8Stream
 */
/**
 * Program: Java8Stream
 */
import java.util.stream.*;
import java.util.Arrays;
import java.util.List;
import java.util.Collections;
public class Java8Stream {
    public static void main(String[] args) {
       finOddIndexValue();

    }

    private static void finOddIndexValue() {
        List<String> li = Arrays.asList("a","b","c","d","e");
        List<String> oddIndexValues =
                IntStream.range(0,li.size()).filter(i->i%2 != 0).mapToObj(li :: get).collect(Collectors.toList());
        System.out.println("Odd index values: " + oddIndexValues);
    }
}
