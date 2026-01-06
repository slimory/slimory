using System;
using System.Windows.Automation;
using System.Windows.Automation.Text;
using System.Text;

class Program
{
    static void Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;

        try
        {
            AutomationElement focused = AutomationElement.FocusedElement;
            if (focused == null) return;

            object patternObj;
            if (focused.TryGetCurrentPattern(TextPattern.Pattern, out patternObj))
            {
                var textPattern = (TextPattern)patternObj;
                var selection = textPattern.GetSelection();

                if (args.Length == 0)
                {
                    if (selection.Length > 0)
                        Console.Write(selection[0].GetText(-1));
                }
                else if (args[0] == "--json")
                {
                    var documentRange = textPattern.DocumentRange;
                    int documentLength = documentRange.GetText(-1).Length;
                    
                    string selectedText = "";
                    int selectionStart = -1;
                    int selectionEnd = -1;
                    
                    if (selection.Length > 0)
                    {
                        var selectedRange = selection[0];
                        selectedText = selectedRange.GetText(-1);
                        
                        var startRange = documentRange.Clone();
                        startRange.MoveEndpointByRange(TextPatternRangeEndpoint.End, selectedRange, TextPatternRangeEndpoint.Start);
                        selectionStart = startRange.GetText(-1).Length;
                        selectionEnd = selectionStart + selectedText.Length;
                    }
                    
                    string fullText = "";
                    if (selectionStart >= 0 && selectionEnd >= 0)
                    {
                        int contextStart = Math.Max(0, selectionStart - 500);
                        int contextEnd = Math.Min(documentLength, selectionEnd + 500);
                        
                        var contextRange = documentRange.Clone();
                        contextRange.MoveEndpointByUnit(TextPatternRangeEndpoint.Start, TextUnit.Character, contextStart);
                        contextRange.MoveEndpointByUnit(TextPatternRangeEndpoint.End, TextUnit.Character, contextEnd - documentLength);
                        fullText = contextRange.GetText(-1);
                    }
                    else
                    {
                        fullText = documentRange.GetText(-1);
                    }
                    
                    Console.Write($"{{\"fullText\":{EscapeJson(fullText)},\"selectedText\":{EscapeJson(selectedText)},\"selectionStart\":{selectionStart},\"selectionEnd\":{selectionEnd}}}");
                }
            }
        }
        catch (Exception ex)
        {
            Console.Error.Write($"Error: {ex.Message}");
        }
    }
    
    static string EscapeJson(string text)
    {
        if (text == null) return "null";
        return "\"" + text.Replace("\\", "\\\\")
                         .Replace("\"", "\\\"")
                         .Replace("\n", "\\n")
                         .Replace("\r", "\\r")
                         .Replace("\t", "\\t") + "\"";
    }
}