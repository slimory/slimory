using System;
using System.Runtime.InteropServices;
using System.Windows.Automation;
using System.Windows.Automation.Text;
using System.Text;
using System.Windows.Forms;
using System.Threading;

public class KeyboardSimulator
{
    private const int INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    
    private const ushort VK_SHIFT = 0x10;
    private const ushort VK_LEFT = 0x25;
    private const ushort VK_RIGHT = 0x27;

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT
    {
        public uint type;
        public InputUnion U;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct InputUnion
    {
        [FieldOffset(0)]
        public MOUSEINPUT mi;
        [FieldOffset(0)]
        public KEYBDINPUT ki;
        [FieldOffset(0)]
        public HARDWAREINPUT hi;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT
    {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct HARDWAREINPUT
    {
        public uint uMsg;
        public ushort wParamL;
        public ushort wParamH;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, [MarshalAs(UnmanagedType.LPArray), In] INPUT[] pInputs, int cbSize);
    
    public static bool SendShiftLeftStable(int count)
    {
        if (count <= 0) return false;

        try
        {
            if (!SendSingleKey(VK_SHIFT, false))
                return false;
            
            System.Threading.Thread.Sleep(30);
            for (int i = 0; i < count; i++)
            {
                INPUT[] inputs = new INPUT[2];
                
                inputs[0] = CreateKeyInput(VK_LEFT, false);
                
                inputs[1] = CreateKeyInput(VK_LEFT, true);
                
                uint result = SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
                
                if (result != 2)
                {
                    Console.WriteLine($"Failed to send arrow key. Sent: {result}");
                    return false;
                }
                
                if (i < count - 1)
                    System.Threading.Thread.Sleep(1);
            }

            System.Threading.Thread.Sleep(30);
            return SendSingleKey(VK_SHIFT, true);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
            return false;
        }
    }

    public static bool SendShiftRightStable(int count)
    {
        if (count <= 0) return false;

        try
        {
            if (!SendSingleKey(VK_SHIFT, false))
                return false;
            
            System.Threading.Thread.Sleep(30);
            for (int i = 0; i < count; i++)
            {
                INPUT[] inputs = new INPUT[2];
                
                inputs[0] = CreateKeyInput(VK_RIGHT, false);
                
                inputs[1] = CreateKeyInput(VK_RIGHT, true);
                
                uint result = SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
                
                if (result != 2)
                {
                    Console.WriteLine($"Failed to send arrow key. Sent: {result}");
                    return false;
                }
                
                if (i < count - 1)
                    System.Threading.Thread.Sleep(1);
            }

            System.Threading.Thread.Sleep(30);
            return SendSingleKey(VK_SHIFT, true);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
            return false;
        }
    }

    public static bool SendShiftLeftBatch(int count)
    {
        if (count <= 0) return false;

        try
        {
            if (!SendSingleKey(VK_SHIFT, false))
            return false;
        
            System.Threading.Thread.Sleep(1);
            
            int processed = 0;
            while (processed < count)
            {
                int remaining = count - processed;
                int batchSize = Math.Min(remaining, 4);
                
                INPUT[] batch = new INPUT[batchSize * 2];
                
                for (int i = 0; i < batchSize; i++)
                {
                    batch[i * 2] = CreateKeyInput(VK_LEFT, false);
                    batch[i * 2 + 1] = CreateKeyInput(VK_LEFT, true);
                }
                
                uint result = SendInput((uint)batch.Length, batch, 
                                    Marshal.SizeOf(typeof(INPUT)));
                
                processed += batchSize;
                
                if (processed < count)
                {
                    System.Threading.Thread.Sleep(1);
                }
            }
            System.Threading.Thread.Sleep(100);
            return SendSingleKey(VK_SHIFT, true);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
            return false;
        }
    }

    private static INPUT CreateKeyInput(ushort keyCode, bool keyUp)
    {
        return new INPUT
        {
            type = INPUT_KEYBOARD,
            U = new InputUnion
            {
                ki = new KEYBDINPUT
                {
                    wVk = keyCode,
                    wScan = 0,
                    dwFlags = keyUp ? KEYEVENTF_KEYUP : 0,
                    time = 0,
                    dwExtraInfo = IntPtr.Zero
                }
            }
        };
    }

    private static bool SendSingleKey(ushort keyCode, bool keyUp)
    {
        INPUT input = CreateKeyInput(keyCode, keyUp);
        INPUT[] inputs = new INPUT[] { input };
        
        uint result = SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
        return result == 1;
    }
}

class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        try {
            Console.OutputEncoding = Encoding.UTF8;
            AutomationElement focused = AutomationElement.FocusedElement;
            object patternObj;
            bool isTextPatternAvailable = focused.TryGetCurrentPattern(TextPattern.Pattern, out patternObj);
            var previousClipboard = Clipboard.GetText();
            if (!isTextPatternAvailable)
            {
                if (args[2] == "toEnd")
                {
                    SendKeys.SendWait("+{LEFT " + 1 + "}");
                    SendKeys.SendWait("^c");
                    System.Threading.Thread.Sleep(50);
                    if (Clipboard.GetText() != args[0].Substring(0, args[0].Length - 1))
                    {
                        KeyboardSimulator.SendShiftLeftStable(args[0].Length - 1);
                    }
                    else
                    {
                        SendKeys.SendWait("+{RIGHT " + 1 + "}");
                    }
                }
                else
                {
                    SendKeys.SendWait("+{RIGHT " + 1 + "}");
                    SendKeys.SendWait("^c");
                    System.Threading.Thread.Sleep(50);
                    if (Clipboard.GetText() != args[0].Substring(1, args[0].Length - 1))
                    {
                        KeyboardSimulator.SendShiftRightStable(args[0].Length - 1);
                    }
                    else
                    {
                        SendKeys.SendWait("+{LEFT " + 1 + "}");
                    }
                }
            }
            try {
                Clipboard.SetText(args[1]);
                System.Threading.Thread.Sleep(100);
                SendKeys.SendWait("^v");
            } catch (Exception ex) {
                Console.Write($"Error: {ex.Message}");
            } finally {
                Clipboard.SetText(previousClipboard);
            }
        } catch (Exception ex) {
            Console.Write($"Error: {ex.Message}");
        }
    }
}